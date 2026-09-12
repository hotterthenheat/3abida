/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE BOARD
  (components/compass/CompassGuide.tsx)

  The Compass board's guide in the house pattern
  (the walk, 2026-09-11): a figure per thing, the
  surface drawn small in its own inks, one sentence
  under each.
==================================================
*/

import type { ReactNode } from 'react';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const BULL = 'rgb(var(--bull))';
const BEAR = 'rgb(var(--bear))';
const WARN = 'rgb(var(--warn))';
const SUPREME = 'rgb(var(--supreme))';
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

/* A card: the rank, the contract in its side's ink, the expiry, the crown, the state; the move, the spark, the premium; what kills it */
const CardFigure = () => (
  <Figure label="One card: #1, NVDA 120P in red, the expiry chip, Top pick in magenta, a Moving chip; the one-sigma move, the session's line, the premium; Breaks above $121.26 in amber and the Open door" h={104}>
    <rect x={4} y={4} width={412} height={96} rx={5} fill="#ffffff" fillOpacity={0.015} stroke={SILVER} strokeOpacity={0.6} />
    <text x={16} y={24} fontSize={7} fill={MUTED} fontFamily={MONO}>
      #1
    </text>
    <rect x={30} y={14} width={62} height={15} rx={3} fill={BEAR} fillOpacity={0.06} stroke={BEAR} strokeOpacity={0.3} />
    <text x={61} y={25} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={BEAR} fontFamily={MONO}>
      NVDA 120P
    </text>
    <rect x={98} y={14} width={70} height={15} rx={3} fill="none" stroke="#2a2a2a" />
    <text x={133} y={25} textAnchor="middle" fontSize={7} fill={SECOND} fontFamily={MONO}>
      0DTE · 09/11/26
    </text>
    <rect x={174} y={14} width={52} height={15} rx={3} fill={SUPREME} fillOpacity={0.1} stroke={SUPREME} strokeOpacity={0.5} />
    <text x={200} y={25} textAnchor="middle" fontSize={6.5} fontWeight={700} letterSpacing={0.6} fill={SUPREME} fontFamily={MONO}>
      TOP PICK
    </text>
    <rect x={346} y={14} width={58} height={15} rx={3} fill="#ffffff" fillOpacity={0.08} />
    <circle cx={356} cy={21.5} r={2} fill={INK} />
    <text x={382} y={25} textAnchor="middle" fontSize={6.5} fontWeight={700} letterSpacing={0.6} fill={INK} fontFamily={MONO}>
      MOVING
    </text>
    <text x={16} y={46} fontSize={6.5} letterSpacing={0.8} fill={MUTED} fontFamily={MONO}>
      1σ MOVE
    </text>
    <text x={16} y={60} fontSize={10} fontWeight={700} fill={INK} fontFamily={MONO}>
      ±1.6%
    </text>
    <polyline points="170,62 185,56 200,58 215,50 230,52 245,44 260,47" fill="none" stroke={BULL} strokeWidth={1.2} />
    <line x1={170} x2={260} y1={62} y2={62} stroke="#ffffff" strokeOpacity={0.12} strokeDasharray="2 2" />
    <text x={404} y={46} textAnchor="end" fontSize={6.5} letterSpacing={0.8} fill={MUTED} fontFamily={MONO}>
      PREMIUM
    </text>
    <text x={404} y={60} textAnchor="end" fontSize={10} fontWeight={700} fill={INK} fontFamily={MONO}>
      $0.75
    </text>
    <path d="M 18 86 l 4 -7 l 4 7 z" fill="none" stroke={WARN} strokeWidth={1} />
    <text x={30} y={87} fontSize={8} fill={WARN} fontFamily={MONO}>
      Breaks above <tspan fontWeight={700}>$121.26</tspan>
    </text>
    <rect x={352} y={77} width={52} height={15} rx={3} fill="none" stroke="#2a2a2a" />
    <text x={378} y={87.5} textAnchor="middle" fontSize={6.5} letterSpacing={0.6} fill={SECOND} fontFamily={MONO}>
      OPEN ↗
    </text>
  </Figure>
);

/* The four states, as the chips they wear */
const StatesFigure = () => (
  <Figure label="Four state chips in a row: Watch and Fading muted, Active and Moving white, Moving with a pulsing dot" h={44}>
    {[
      { x: 10, w: 68, t: 'WATCH', lit: false },
      { x: 88, w: 70, t: 'ACTIVE', lit: true },
      { x: 168, w: 72, t: 'MOVING', lit: true },
      { x: 250, w: 70, t: 'FADING', lit: false },
    ].map(c => (
      <g key={c.t}>
        <rect x={c.x} y={13} width={c.w} height={18} rx={3} fill="#ffffff" fillOpacity={c.lit ? 0.08 : 0.03} stroke={c.lit ? 'none' : '#2a2a2a'} />
        <circle cx={c.x + 11} cy={22} r={2.2} fill={c.lit ? INK : MUTED} />
        <text x={c.x + c.w / 2 + 6} y={25.5} textAnchor="middle" fontSize={7} fontWeight={700} letterSpacing={0.8} fill={c.lit ? INK : SECOND} fontFamily={MONO}>
          {c.t}
        </text>
      </g>
    ))}
    <text x={334} y={20} fontSize={6.5} fill={MUTED} fontFamily={MONO}>
      left to right:
    </text>
    <text x={334} y={30} fontSize={6.5} fill={MUTED} fontFamily={MONO}>
      proving → in place → trading → retiring
    </text>
  </Figure>
);

/* The rail: one row of the heaviest contracts, the ranked column bright with its bar */
const RailFigure = () => (
  <Figure label="Two rows of the heaviest contracts: #1 NVDA 125P and #2 NVDA 127.50C, four facts under their heads — gamma share lit with a bar, volume over open interest, distance from spot, exposure in its sign's ink" h={96}>
    <g fontFamily={MONO} fontSize={6.5} fill={MUTED} letterSpacing={0.8}>
      <text x={12} y={14} fill={INK}>GAMMA</text>
      <text x={112} y={14}>VOL/OI</text>
      <text x={212} y={14}>FROM SPOT</text>
      <text x={312} y={14}>EXPOSURE</text>
    </g>
    <line x1={12} x2={70} y1={17} y2={17} stroke={INK} strokeWidth={0.8} />
    <line x1={0} x2={420} y1={22} y2={22} stroke="#ffffff" strokeOpacity={0.08} />
    {[
      { y: 38, r: '#1', c: 'NVDA 125', s: 'P', g: '10.6%', v: '1.51×', d: '−0.5%', e: '$94.6M', bar: 1, ink: BEAR },
      { y: 72, r: '#2', c: 'NVDA 127.50', s: 'C', g: '7.1%', v: '1.47×', d: '+1.4%', e: '−$63.0M', bar: 0.67, ink: BULL },
    ].map(row => (
      <g key={row.r}>
        <text x={12} y={row.y} fontSize={7} fill={MUTED} fontFamily={MONO}>
          {row.r}
        </text>
        <text x={34} y={row.y} fontSize={9} fontWeight={600} fill={INK} fontFamily={MONO}>
          {row.c}
          <tspan fill={row.ink}>{row.s}</tspan>
        </text>
        <text x={118} y={row.y} fontSize={6.5} fill={MUTED} fontFamily={MONO}>
          0DTE
        </text>
        <text x={12} y={row.y + 14} fontSize={8.5} fontWeight={700} fill={INK} fontFamily={MONO}>
          {row.g}
        </text>
        <rect x={12} y={row.y + 18} width={80} height={2} rx={1} fill="#ffffff" fillOpacity={0.07} />
        <rect x={12} y={row.y + 18} width={80 * row.bar} height={2} rx={1} fill={row.ink} fillOpacity={0.8} />
        <text x={112} y={row.y + 14} fontSize={8} fill={SECOND} fontFamily={MONO}>
          {row.v}
        </text>
        <text x={212} y={row.y + 14} fontSize={8} fill={SECOND} fontFamily={MONO}>
          {row.d}
        </text>
        <text x={312} y={row.y + 14} fontSize={8} fontWeight={600} fill={row.e.startsWith('−') ? BULL : BEAR} fontFamily={MONO}>
          {row.e}
        </text>
      </g>
    ))}
  </Figure>
);

export const CompassGuide = () => (
  <div data-compass-guide>
    <Section title="A card">
      <p>One setup: its rank, the contract in its side's ink, the expiry, and its state. Under them the one-sigma move to expiry, the stock's line today, and the premium. The amber line is the stock price that retires it. One click selects a card, a second opens its page.</p>
      <CardFigure />
    </Section>
    <Section title="The states">
      <p>Watch is on the board but not proven. Active means the level structure is in place. Moving means the contract now trades like its trade. Fading means it is retiring.</p>
      <StatesFigure />
    </Section>
    <Section title="Expiry and kind">
      <p>The Expiry card picks how long the trade lives, from today's contracts to a year out. The Kind card picks what found it: the strongest by trend and hedging, a quick scalp, a discount, a rebound, or big orders. Not every kind sells on every expiry: a scalp has no business a year out.</p>
    </Section>
    <Section title="The heaviest contracts">
      <p>Beside the board, the contracts that carry the most weight on the selected card's name. Click a column head to rank by it; the ranked column lights up with a bar. A row opens that contract's page.</p>
      <RailFigure />
    </Section>
  </div>
);

export default CompassGuide;
