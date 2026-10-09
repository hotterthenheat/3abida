/*
==================================================
  SLAYER TERMINAL - HOW TO READ A NAME
  (components/record/StockGuide.tsx)

  The stock overview page's guide, in the house
  pattern: a sentence a section, figures drawn in
  the page's own grammar (the pillar bar against
  the 50 line, a factor's lean from the middle),
  and "Today" from the figures on screen.
==================================================
*/

import type { ReactNode } from 'react';
import type { StockOverview } from '../../data/stockOverview';
import { gradeOf, gradeOfComposite, type Grade } from '../../data/stockOverview';
import { FONT_SANS } from '../../theme/fonts';

const BULL = 'rgb(var(--bull))';
const BEAR = 'rgb(var(--bear))';
const SILVER = 'rgb(var(--silver))';
const SUPREME = 'rgb(var(--supreme))';
const MUTED = '#8a909c';
const INK = '#ededed';
/* the figures' voice — Helvetica's digits are tabular (theme/fonts.ts) */
const FIG = FONT_SANS;
const SANS = FONT_SANS;

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="px-5 py-4 border-b border-borderSubtle/60 last:border-b-0">
    <h4 className="text-[13px] font-semibold text-textPrimary">{title}</h4>
    <div className="mt-2 text-[12px] leading-relaxed text-textSecondary">{children}</div>
  </section>
);
const Figure = ({ children, label, h = 150 }: { children: ReactNode; label: string; h?: number }) => (
  <figure data-theme="dark" className="mt-3 rounded-md border border-borderSubtle/60 bg-panel p-2">
    <svg viewBox={`0 0 420 ${h}`} width="100%" role="img" aria-label={label} data-guide-figure>
      {children}
    </svg>
  </figure>
);

/** The four pillars as words on the three-step meter, the read under them (no figure of ours: Noah, 2026-09-19) */
const WARN = 'rgb(var(--warn))';
const GRADE_FILL: Record<Grade, string> = { strong: BULL, good: BULL, caution: WARN, poor: BEAR };
const PillarsFigure = () => {
  const rows: { name: string; grade: Grade }[] = [
    { name: 'The trend', grade: 'strong' },
    { name: 'The numbers', grade: 'good' },
    { name: 'The money', grade: 'poor' },
    { name: 'The news', grade: 'caution' },
  ];
  const x0 = 120;
  const seg = 48;
  const gap = 6;
  const steps: Grade[] = ['poor', 'caution', 'good', 'strong'];
  /* filled up to the word that holds, in that word's ink — the page's own meter */
  const meter = (y: number, grade: Grade) =>
    steps.map((st, k) => <rect key={st} x={x0 + k * (seg + gap)} y={y - 3} width={seg} height={6} rx={3} fill={k <= steps.indexOf(grade) ? GRADE_FILL[grade] : '#ffffff'} fillOpacity={k <= steps.indexOf(grade) ? 1 : 0.07} />);
  return (
    <Figure label="Four pillars, each on a four-step meter — poor, caution, good, strong — filled up to the word that holds, with the word beside it; under them the read, one of the same four words" h={140}>
      {steps.map((st, k) => (
        <text key={st} x={x0 + k * (seg + gap) + seg / 2} y={10} textAnchor="middle" fontSize={7} letterSpacing={0.8} fill={MUTED} fontFamily={FIG}>
          {st.toUpperCase()}
        </text>
      ))}
      {rows.map((r, i) => {
        const y = 28 + i * 22;
        return (
          <g key={r.name}>
            <text x={12} y={y + 3.5} fontSize={9} fill={MUTED} fontFamily={SANS}>
              {r.name}
            </text>
            {meter(y, r.grade)}
            <text x={408} y={y + 3.5} textAnchor="end" fontSize={10} fontWeight={700} fill={GRADE_FILL[r.grade]} fontFamily={FIG}>
              {r.grade}
            </text>
          </g>
        );
      })}
      <line x1={12} x2={408} y1={114} y2={114} stroke="#ffffff" strokeOpacity={0.12} />
      <text x={12} y={130} fontSize={9} fill={INK} fontFamily={SANS}>
        the read
      </text>
      {meter(127, 'good')}
      <text x={408} y={130} textAnchor="end" fontSize={11} fontWeight={700} fill={BULL} fontFamily={FIG}>
        good
      </text>
    </Figure>
  );
};

/** A factor row: the label and its note, the figure, the lean from the middle */
const FactorFigure = () => {
  const rows = [
    { label: 'Price against its 20-day average', note: 'above its average — the trend holds', value: '+2.1% · 184.30', lean: 0.7 },
    { label: 'Call premium against put premium', note: 'the money leans to puts', value: '$4M vs $9M · 0.4×', lean: -0.55 },
    { label: 'Relative volume', note: 'ordinary', value: '1.02×', lean: 0.02 },
  ];
  return (
    <Figure label="Three factor rows: the words and the figure at the left, and at the right the lean — right in green for the name, left in red against it" h={110}>
      {rows.map((r, i) => {
        const y = 22 + i * 30;
        const x0 = 300;
        const w = 100;
        const mid = x0 + w / 2;
        const len = Math.abs(r.lean) * (w / 2);
        return (
          <g key={r.label}>
            <text x={12} y={y} fontSize={9} fill={INK} fontFamily={SANS}>
              {r.label}
            </text>
            <text x={12} y={y + 11} fontSize={7.5} fill={MUTED} fontFamily={SANS}>
              {r.note}
            </text>
            <text x={290} y={y + 4} textAnchor="end" fontSize={8.5} fill={INK} fontFamily={FIG}>
              {r.value}
            </text>
            <rect x={x0} y={y + 1} width={w} height={4} rx={2} fill="#ffffff" fillOpacity={0.06} />
            <line x1={mid} x2={mid} y1={y - 1} y2={y + 7} stroke="#ffffff" strokeOpacity={0.25} />
            <rect x={r.lean >= 0 ? mid : mid - len} y={y + 1} width={len} height={4} rx={2} fill={r.lean >= 0 ? BULL : BEAR} fillOpacity={r.lean >= 0 ? 1 : 0.7} />
          </g>
        );
      })}
    </Figure>
  );
};

/** Three factors, each saying for or against — a bar's length for how much, a word at the end, a count under them */
const PointsFigure = () => {
  const rows: [string, string, number][] = [
    ["The wire's lean", 'NEWS', 1],
    ['The structure', 'TREND', 0.64],
    ['Price against fair value', 'NUMBERS', -0.2],
  ];
  return (
    <Figure label="Three factors: the wire's lean with a long green bar to the right of the middle and the word for, the structure with a shorter one and the word for, price against fair value with a short red bar to the left and the word against; under them, 2 for it, 1 against, the read good" h={112}>
      {rows.map(([label, pillar, v], i) => {
        const y = 18 + i * 26;
        const w = Math.abs(v) * 70;
        return (
          <g key={label}>
            <text x={12} y={y + 4} fontSize={9} fill={INK} fontFamily={SANS}>
              {label}
            </text>
            <text x={12 + label.length * 5.1 + 6} y={y + 4} fontSize={6} letterSpacing={1} fill={MUTED} fontFamily={FIG}>
              {pillar}
            </text>
            <rect x={230} y={y - 2} width={140} height={4} rx={2} fill="#ffffff" fillOpacity={0.06} />
            <line x1={300} x2={300} y1={y - 4} y2={y + 6} stroke="#ffffff" strokeOpacity={0.25} />
            <rect x={v >= 0 ? 300 : 300 - w} y={y - 2} width={w} height={4} rx={2} fill={v >= 0 ? BULL : BEAR} />
            <text x={408} y={y + 4} textAnchor="end" fontSize={7.5} fontWeight={700} letterSpacing={0.8} fill={v >= 0 ? BULL : BEAR} fontFamily={FIG}>
              {v >= 0 ? 'FOR' : 'AGAINST'}
            </text>
          </g>
        );
      })}
      <line x1={12} x2={408} y1={92} y2={92} stroke="#ffffff" strokeOpacity={0.1} />
      <text x={12} y={106} fontSize={8} fill={MUTED} fontFamily={FIG}>
        <tspan fill={BULL} fontWeight={700}>2</tspan> for it · <tspan fill={BEAR} fontWeight={700}>1</tspan> against
      </text>
      <text x={408} y={106} textAnchor="end" fontSize={8} fill={MUTED} fontFamily={FIG}>
        the read <tspan fill={BULL} fontWeight={700}>good</tspan>
      </text>
    </Figure>
  );
};

/** The book on a price scale: five marks in their inks */
const ScaleFigure = () => {
  const marks: [string, string, number, string][] = [
    ['put wall', '116.5', 40, BEAR],
    ['flip', '116.75', 62, SILVER],
    ['supreme', '119', 220, SUPREME],
    ['spot', '120.00', 300, INK],
    ['call wall', '121', 372, BULL],
  ];
  return (
    <Figure label="A price scale from left to right: put wall 116.5 in red, flip 116.75 dashed in silver, supreme 119 in magenta, spot 120.00 as a plain white tick, call wall 121 in green" h={64}>
      <line x1={12} x2={408} y1={32} y2={32} stroke="#ffffff" strokeOpacity={0.14} />
      <rect x={40} y={29} width={332} height={6} fill={SILVER} fillOpacity={0.1} />
      {marks.map(([word, price, x, ink], i) => {
        const up = i === 1;
        const isSpot = word === 'spot';
        return (
          <g key={word}>
            <line x1={x} x2={x} y1={isSpot ? 23 : 27} y2={isSpot ? 41 : 37} stroke={ink} strokeWidth={isSpot ? 2 : 1.25} strokeDasharray={word === 'flip' ? '2 2' : undefined} />
            <text x={x} y={up ? 18 : 50} textAnchor="middle" fontSize={8.5} fontWeight={isSpot ? 700 : 500} fill={ink} fontFamily={FIG}>
              {price}
            </text>
            <text x={x} y={up ? 9 : 59} textAnchor="middle" fontSize={6.5} letterSpacing={0.6} fill={ink} fillOpacity={0.75} fontFamily={FIG}>
              {word.toUpperCase()}
            </text>
          </g>
        );
      })}
    </Figure>
  );
};

export const StockGuide = ({ view }: { view: StockOverview }) => (
  <div data-stock-guide>
    <Section title="The read">
      <p>Four pillars — the trend, the numbers, the money, the news — each a handful of facts the terminal can read. Each pillar reads strong, good, caution or poor, and the four together give the name one of the same four words. Good means the facts line up for the name, poor means they line up against it, caution means they disagree or sit in the middle. Strong is kept for a name where nearly everything lines up at once, so it is rare on purpose.</p>
      <PillarsFigure />
    </Section>
    <Section title="A factor">
      <p>Every fact under a pillar is a factor: its figure, one clause on what it says, and its lean from the middle — to the right in green when it reads for the name, to the left in red when it reads against it. A pillar is the balance of its factors.</p>
      <FactorFigure />
    </Section>
    <Section title="What is behind it">
      <p>Under "Behind the read", every factor is listed with the heaviest first: a bar to the right in green when it speaks for the name, to the left in red when it speaks against it, and the word at the end. The longer the bar, the more that factor matters to the read. The moves beside the list say what the read would become if a factor turned the other way: it stays where it is, or it changes to another of the four words.</p>
      <PointsFigure />
    </Section>
    <Section title="The book on a scale">
      <p>In "The money", one line puts the put wall, the flip, spot, the call wall and the supreme on a price scale, each in its own ink — where the price sits between the walls, at a glance. "The numbers" does the same for fair value: the cheap fifth in green, the rich fifth in red, the price as a plain tick.</p>
      <ScaleFigure />
    </Section>
    <Section title="Do the pillars agree">
      <p>The read also leans bullish, bearish or neutral. Under "Why now", each pillar is marked as agreeing with that lean or arguing against it, and the line under them names where the read fails first if it fails — the strongest pillar on the other side, or the next report when every pillar agrees.</p>
    </Section>
    <Section title="What each part reads">
      <p>The trend reads the name's own sessions, the money reads the book, the flow book and the dark pool, the news reads the wire and the tape's prints. The numbers read the last report. Every source's status and time sits in "Behind the read"; the method behind it — what was observed, derived and inferred — sits behind the fold under it.</p>
    </Section>
    <Section title="Today">
      <p>
        {view.name} reads {gradeOfComposite(view.composite)}: {view.pillars.map(p => `${p.name.toLowerCase()} ${gradeOf(p.score)}`).join(' · ')}.
      </p>
      <p className="mt-1">{view.thesis}</p>
    </Section>
  </div>
);
