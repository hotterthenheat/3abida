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

/* The watchlist: two rows of the list — the pill, when it was added, the mark, today's and the total return — the picked one in silver */
const ListFigure = () => (
  <Figure label="Two watchlist rows: SPY 512C added today at a mark of $2.19, +$0 today and +$0 in all; SPY 507C picked, in the silver selection, added today at $3.24, −$7 and −0.02R today and in all" h={72}>
    <g fontFamily={MONO} fontSize={6.5} fill={MUTED} letterSpacing={0.6}>
      <text x={12} y={12}>CONTRACT</text>
      <text x={190} y={12}>ADDED</text>
      <text x={280} y={12} textAnchor="end">MARK</text>
      <text x={345} y={12} textAnchor="end">TODAY</text>
      <text x={408} y={12} textAnchor="end">TOTAL</text>
    </g>
    <line x1={0} x2={420} y1={17} y2={17} stroke="#ffffff" strokeOpacity={0.08} />
    {[
      { y: 36, c: 'SPY 507C', on: true, m: '$3.24', t: '−$7 · −0.02R', ink: BEAR },
      { y: 60, c: 'SPY 512C', on: false, m: '$2.19', t: '+$0 · +0.00R', ink: INK },
    ].map(r => (
      <g key={r.c} fontFamily={MONO}>
        {r.on && <rect x={0} y={r.y - 15} width={420} height={24} fill={SILVER} fillOpacity={0.08} />}
        <rect x={12} y={r.y - 10} width={60} height={13} rx={2} fill={BULL} fillOpacity={0.08} stroke={BULL} strokeOpacity={0.35} />
        <text x={42} y={r.y} textAnchor="middle" fontSize={7.5} fontWeight={700} fill={BULL}>
          {r.c}
        </text>
        <text x={80} y={r.y} fontSize={6.5} fill={MUTED}>
          · Sep 16
        </text>
        <text x={190} y={r.y} fontSize={7.5} fill={SECOND}>
          09/14 · today
        </text>
        <text x={280} y={r.y} textAnchor="end" fontSize={8} fill={INK}>
          {r.m}
        </text>
        <text x={345} y={r.y} textAnchor="end" fontSize={7.5} fill={r.ink}>
          {r.t}
        </text>
        <text x={408} y={r.y} textAnchor="end" fontSize={7.5} fontWeight={700} fill={r.ink}>
          {r.t}
        </text>
      </g>
    ))}
  </Figure>
);

/* The contract card: the watchlist position's eight facts over the Stats, the doors under */
const PositionFigure = () => (
  <Figure label="The position card for a watched contract: WATCHLIST POSITION with Market value $324, Cost when added $3.24 · 1R, Today's return −$7 · −0.02R in red, Total return the same, Breakeven, Contracts 1, Date added and Expiry; under it By price — profit or loss across the stock's price, red below the strike and green above at expiry, today's softer dashed line, the market's hairline with its dot on today's line and the ruler's price as a second hairline with a dot on each line; the foot reads 'On your watchlist · since Sep 14' with the Watching and Close doors" h={118}>
    <text x={12} y={14} fontSize={6.5} fontWeight={700} letterSpacing={0.6} fill={SECOND} fontFamily={MONO}>
      WATCHLIST POSITION
    </text>
    <text x={98} y={14} fontSize={6.5} fill={MUTED} fontFamily={MONO}>
      · marked by the model
    </text>
    {[
      { x: 12, y: 30, l: 'MARKET VALUE', v: '$324.00', ink: INK },
      { x: 112, y: 30, l: 'COST WHEN ADDED', v: '$3.24 · 1R', ink: INK },
      { x: 212, y: 30, l: "TODAY'S RETURN", v: '−$7 · −0.02R', ink: BEAR },
      { x: 312, y: 30, l: 'TOTAL RETURN', v: '−$7 · −0.02R', ink: BEAR },
      { x: 12, y: 56, l: 'BREAKEVEN', v: '$510.24 · +0.5% away', ink: INK },
      { x: 112, y: 56, l: 'CONTRACTS', v: '− 1 +', ink: INK },
      { x: 212, y: 56, l: 'DATE ADDED', v: '09/14 · today', ink: INK },
      { x: 312, y: 56, l: 'EXPIRY', v: 'Sep 16 · 2 sessions', ink: INK },
    ].map(f => (
      <g key={f.l} fontFamily={MONO}>
        <text x={f.x} y={f.y} fontSize={6} letterSpacing={0.6} fill={SILVER}>
          {f.l}
        </text>
        <text x={f.x} y={f.y + 11} fontSize={7.5} fontWeight={700} fill={f.ink}>
          {f.v}
        </text>
      </g>
    ))}
    {/* the payoff sketch — the hard line at expiry with its green and red fills, today's soft line, the walls */}
    <line x1={12} x2={408} y1={92} y2={92} stroke="#ffffff" strokeOpacity={0.22} />
    <path d="M 12 100 L 250 100 L 408 62 L 408 92 L 250 92 L 12 92 Z" fill={BEAR} fillOpacity={0.14} />
    <path d="M 250 92 L 408 62 L 408 92 Z" fill={BULL} fillOpacity={0.14} />
    <path d="M 12 100 L 250 100" fill="none" stroke={BEAR} strokeWidth={1.2} />
    <path d="M 250 100 L 408 62" fill="none" stroke={BULL} strokeWidth={1.2} />
    <path d="M 12 99 C 150 99, 230 96, 300 84 S 380 66, 408 60" fill="none" stroke={SILVER} strokeWidth={1} strokeDasharray="3 3" />
    {/* two verticals and no more (2026-09-14): the market's line with its dot on today's line, and
        the ruler's price with a dot on each line — the walls stand on the ruler under the chart */}
    <line x1={300} x2={300} y1={62} y2={104} stroke={SILVER} strokeOpacity={0.35} strokeWidth={0.8} />
    <circle cx={300} cy={84} r={1.8} fill={SILVER} stroke="#0a0a0a" strokeWidth={0.8} />
    <line x1={350} x2={350} y1={62} y2={104} stroke={SILVER} strokeOpacity={0.6} strokeWidth={0.8} />
    <circle cx={350} cy={74} r={1.8} fill="#0e0e0f" stroke={SILVER} strokeWidth={0.8} />
    <circle cx={350} cy={76} r={2} fill={BULL} stroke="#0e0e0f" strokeWidth={0.8} />
    <text x={408} y={60} textAnchor="end" fontSize={5} fill={SILVER} fontFamily={MONO}>
      ┄ today
    </text>
    <line x1={0} x2={420} y1={106} y2={106} stroke="#ffffff" strokeOpacity={0.08} />
    <text x={12} y={115} fontSize={6.5} fill={INK} fontFamily={MONO}>
      On your watchlist · since Sep 14
    </text>
    <rect x={318} y={108} width={44} height={10} rx={2} fill="#ffffff" fillOpacity={0.06} />
    <text x={340} y={115.5} textAnchor="middle" fontSize={5.5} letterSpacing={0.5} fill={INK} fontFamily={MONO}>
      WATCHING
    </text>
    <rect x={368} y={108} width={40} height={10} rx={2} fill="#ffffff" fillOpacity={0.06} />
    <text x={388} y={115.5} textAnchor="middle" fontSize={5.5} letterSpacing={0.5} fill={SECOND} fontFamily={MONO}>
      CLOSE
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
      <p>Every contract on the name for the expiry you picked, strikes down the left with the market's price on a hairline between the two it sits between. One click opens a strike's Stats and Greeks under it; a double click puts it on the chart; the + at the row's end adds it to your watchlist, and a check stays once it is on. The Side, Expiry, Reach and Columns cards above it change what the chain shows.</p>
      <ChainFigure />
    </Section>
    <Section title="The watchlist">
      <p>One list, two kinds of rows. The contracts you watch: + on a strike marks it at that moment's price, and from then on the row tracks it as if you had bought it — the mark now, today's move and the total since it was added, in dollars and in R, where the cost is one R. And the positions you own or sold: Add a position takes the strike, the side, how many, the expiry and what you paid, and the row reads against that. Each row is tagged for what it is. A row puts that contract on the desk. The List card turns the same window into the scanner: the gainers, the losers, or the busiest option tapes.</p>
      <ListFigure />
    </Section>
    <Section title="The contract">
      <p>The row you picked — a contract you watch, or a position you own or sold — as simulated returns. The figures first: the return at the chosen price now, the estimated contract price, the sessions left. By date draws that return over every session to the bell, sinking as time runs out, with the most a bought contract can lose as a dashed floor; hover any day. The ruler under it is the stock's price: drag it by the cent and every figure follows; the put wall, the flip and the call wall stand on it. By price is the other cut — profit or loss across price at expiry and today, the kept price on it. Then what it has done since it was added, or against what you paid, and the map's five facts: where it sits, the breakeven at expiry, what it would be worth if it expired here, the dealer gamma at the strike, when it expires. Close locks a watched return at the mark now; a position has Change and Remove.</p>
      <PositionFigure />
    </Section>
    <Section title="The chart">
      <p>The same chart as Pulse, with the same strip: the name, then Stock or Premium, then the timeframes, overlays, indicators and alerts. Stock is the name's own chart with its levels; Premium is the picked contract's modeled premium. The expand door at the right takes it full screen.</p>
      <StripFigure />
    </Section>
  </div>
);

export default WeigherGuide;
