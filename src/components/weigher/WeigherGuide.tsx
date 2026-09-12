/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE WEIGHER
  (components/weigher/WeigherGuide.tsx)

  The desk's guide in the house pattern (the walk,
  2026-09-11): a figure per thing, the surface drawn
  small in its own inks, one sentence under each.
==================================================
*/

import type { ReactNode } from 'react';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const BULL = 'rgb(var(--bull))';
const BEAR = 'rgb(var(--bear))';
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

/* The chain: strikes down the left, the market's hairline between two of them, the picked row in silver */
const ChainFigure = () => (
  <Figure label="Five chain rows with the strike, mark, delta, IV, ITM odds and volume; the market's hairline reads 515.94 between 516 and 515; the 515 row is picked, its chevron turned and its strike in silver" h={118}>
    <g fontFamily={MONO} fontSize={6.5} fill={MUTED} letterSpacing={0.6}>
      <text x={12} y={12}>STRIKE</text>
      <text x={130} y={12} textAnchor="end">MARK</text>
      <text x={200} y={12} textAnchor="end">DELTA</text>
      <text x={260} y={12} textAnchor="end">IV</text>
      <text x={340} y={12} textAnchor="end">ITM ODDS</text>
      <text x={408} y={12} textAnchor="end">VOL</text>
    </g>
    <line x1={0} x2={420} y1={17} y2={17} stroke="#ffffff" strokeOpacity={0.08} />
    {[
      { y: 32, s: '517', m: '$1.90', d: '0.42', iv: '15%', o: '42%', v: '32.7K', on: false },
      { y: 52, s: '516', m: '$1.95', d: '0.50', iv: '15%', o: '50%', v: '15.4K', on: false },
      { y: 84, s: '515', m: '$2.85', d: '0.58', iv: '15%', o: '58%', v: '11.2K', on: true },
      { y: 104, s: '514', m: '$3.74', d: '0.66', iv: '15%', o: '66%', v: '14.3K', on: false },
    ].map(r => (
      <g key={r.s} fontFamily={MONO}>
        {r.on && <rect x={0} y={r.y - 13} width={420} height={20} fill={SILVER} fillOpacity={0.08} />}
        <path d={r.on ? `M ${14} ${r.y - 6} l 4 3 l -4 3 z` : `M ${12} ${r.y - 6} l 3 3 l -3 3`} fill={r.on ? SILVER : 'none'} stroke={r.on ? SILVER : MUTED} strokeWidth={1} transform={r.on ? `rotate(90 ${16} ${r.y - 3})` : undefined} />
        <text x={24} y={r.y} fontSize={8.5} fontWeight={700} fill={r.on ? SILVER : INK}>
          {r.s}
        </text>
        <text x={130} y={r.y} textAnchor="end" fontSize={8.5} fontWeight={700} fill={INK}>
          {r.m}
        </text>
        <text x={200} y={r.y} textAnchor="end" fontSize={8} fill={SECOND}>
          {r.d}
        </text>
        <text x={260} y={r.y} textAnchor="end" fontSize={8} fill={SECOND}>
          {r.iv}
        </text>
        <text x={340} y={r.y} textAnchor="end" fontSize={8} fill={SECOND}>
          {r.o}
        </text>
        <text x={408} y={r.y} textAnchor="end" fontSize={8} fill={SECOND}>
          {r.v}
        </text>
      </g>
    ))}
    <line x1={12} x2={182} y1={64} y2={64} stroke={INK} strokeOpacity={0.25} />
    <rect x={186} y={58} width={48} height={12} rx={2} fill="#ffffff" fillOpacity={0.06} />
    <text x={210} y={67} textAnchor="middle" fontSize={7} fontWeight={700} fill={INK} fontFamily={MONO}>
      515.94
    </text>
    <line x1={238} x2={408} y1={64} y2={64} stroke={INK} strokeOpacity={0.25} />
  </Figure>
);

/* The contract's read: the state chip and the case, then the six factor meters, edge and risk */
const ReadFigure = () => (
  <Figure label="The contract's read: an ACTIVE chip, 'a strong case' and 82%; three factor meters — Liquidity full green, Time value half grey, Distance short red — with a line each; Edge in green and Risk in red" h={112}>
    <rect x={12} y={8} width={52} height={15} rx={3} fill="#ffffff" fillOpacity={0.08} />
    <circle cx={22} cy={15.5} r={2} fill={INK} />
    <text x={44} y={19} textAnchor="middle" fontSize={6.5} fontWeight={700} letterSpacing={0.6} fill={INK} fontFamily={MONO}>
      ACTIVE
    </text>
    <text x={72} y={19} fontSize={8} fontWeight={600} fill={BULL} fontFamily={MONO}>
      a strong case
    </text>
    <text x={150} y={19} fontSize={8} fill={SECOND} fontFamily={MONO}>
      82%
    </text>
    <text x={408} y={19} textAnchor="end" fontSize={6.5} fill={MUTED} fontFamily={MONO}>
      graded as a weekly contract
    </text>
    {[
      { y: 40, l: 'LIQUIDITY', v: 0.92, ink: BULL, words: 'a tight spread, the fill is honest' },
      { y: 62, l: 'TIME VALUE', v: 0.5, ink: 'rgba(255,255,255,0.3)', words: 'half the price is time — it melts by the day' },
      { y: 84, l: 'DISTANCE', v: 0.2, ink: BEAR, words: 'far from the money for the time it has' },
    ].map(m => (
      <g key={m.l} fontFamily={MONO}>
        <text x={12} y={m.y} fontSize={6.5} letterSpacing={0.6} fill={SECOND}>
          {m.l}
        </text>
        <rect x={90} y={m.y - 5} width={110} height={4} rx={2} fill="#ffffff" fillOpacity={0.06} />
        <rect x={90} y={m.y - 5} width={110 * m.v} height={4} rx={2} fill={m.ink} />
        <text x={210} y={m.y} fontSize={7} fill={INK}>
          {m.words}
        </text>
      </g>
    ))}
    <line x1={12} x2={408} y1={94} y2={94} stroke="#ffffff" strokeOpacity={0.08} />
    <text x={12} y={106} fontSize={6.5} fontWeight={700} letterSpacing={0.6} fill={BULL} fontFamily={MONO}>
      EDGE
    </text>
    <text x={44} y={106} fontSize={7} fill={INK} fontFamily={MONO}>
      the walls above give it room to run
    </text>
    <text x={230} y={106} fontSize={6.5} fontWeight={700} letterSpacing={0.6} fill={BEAR} fontFamily={MONO}>
      RISK
    </text>
    <text x={258} y={106} fontSize={7} fill={INK} fontFamily={MONO}>
      a close under 512 ends it
    </text>
  </Figure>
);

/* The chart's two views, one strip */
const StripFigure = () => (
  <Figure label="The chart's strip: the name capsule SPY with its price, Stock and Premium with Stock underlined, the timeframes, the overlay and indicator glyphs, the expand door at the right" h={44}>
    <rect x={10} y={12} width={54} height={20} rx={10} fill="#ffffff" fillOpacity={0.06} />
    <text x={37} y={25.5} textAnchor="middle" fontSize={8} fontWeight={700} fill={INK} fontFamily={MONO}>
      SPY ▾
    </text>
    <text x={72} y={25.5} fontSize={8} fontWeight={600} fill={INK} fontFamily={MONO}>
      $515.87
    </text>
    <text x={118} y={25.5} fontSize={8} fontWeight={600} fill={BULL} fontFamily={MONO}>
      ▲ +3.2%
    </text>
    <text x={170} y={25.5} fontSize={7} letterSpacing={0.8} fill={INK} fontFamily={MONO}>
      STOCK
    </text>
    <line x1={170} x2={196} y1={29} y2={29} stroke={INK} />
    <text x={206} y={25.5} fontSize={7} letterSpacing={0.8} fill={MUTED} fontFamily={MONO}>
      PREMIUM
    </text>
    <rect x={256} y={14} width={24} height={16} rx={8} fill="#ffffff" fillOpacity={0.1} />
    <text x={268} y={25.5} textAnchor="middle" fontSize={7.5} fontWeight={700} fill={INK} fontFamily={MONO}>
      1m
    </text>
    {['5m', '15m', '1h'].map((t, i) => (
      <text key={t} x={292 + i * 24} y={25.5} textAnchor="middle" fontSize={7.5} fill={MUTED} fontFamily={MONO}>
        {t}
      </text>
    ))}
    <text x={370} y={25.5} fontSize={7} fill={MUTED} fontFamily={MONO}>
      ◈ ∿ ♪
    </text>
    <text x={404} y={26} textAnchor="end" fontSize={9} fill={MUTED} fontFamily={MONO}>
      ⤢
    </text>
  </Figure>
);

export const WeigherGuide = () => (
  <div data-weigher-guide>
    <Section title="The chain">
      <p>Every contract on the name for the expiry you picked, strikes down the left with the market's price on a hairline between the two it sits between. One click weighs a strike and its read lands in the card below; a double click puts that contract on the chart. The Side, Expiry, Reach and Columns cards above it change what the chain shows.</p>
      <ChainFigure />
    </Section>
    <Section title="The contract's read">
      <p>The same grade the Compass board gives, so the two can never disagree: the state, the case in one word, and the confidence. Under it the six things the contract itself is made of, each a meter with a line saying why, then the edge that speaks for it and the risk that speaks against it, and whether it is on today's board.</p>
      <ReadFigure />
    </Section>
    <Section title="The chart">
      <p>The same chart as Pulse, with the same strip: the name, then Stock or Premium, then the timeframes, overlays, indicators and alerts. Stock is the name's own chart with its levels; Premium is the picked contract's modeled premium. The expand door at the right takes it full screen.</p>
      <StripFigure />
    </Section>
    <Section title="The scanner">
      <p>Names worth a look today: the gainers, the losers, or the busiest option tapes. A row puts that name on the desk, and the chain and the chart follow it.</p>
    </Section>
  </div>
);

export default WeigherGuide;
