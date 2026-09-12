/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE CALENDAR
  (components/record/EarningsGuide.tsx)

  The Earnings page's guide in the house pattern:
  a figure per thing, the surface drawn small in
  its own inks, one sentence under each.
==================================================
*/

import type { ReactNode } from 'react';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const BULL = 'rgb(var(--bull))';
const BEAR = 'rgb(var(--bear))';
const WARN = 'rgb(var(--warn))';
const MUTED = '#7c8290';
const INK = 'rgb(var(--text-primary))';
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

/* A day on the board: the day's head, the shelf, two cards */
const BoardDayFigure = () => (
  <Figure label="One day of the board: the date at the head in silver as today, a before-the-open shelf, two name cards with their options price and whether the date is confirmed" h={96}>
    <rect x={0} y={0} width={420} height={96} fill={SILVER} fillOpacity={0.04} />
    <text x={12} y={16} fontSize={9} fontWeight={700} fill={SILVER} fontFamily={MONO}>
      Thu 09/10
    </text>
    <text x={408} y={16} textAnchor="end" fontSize={6} letterSpacing={1} fill={SILVER} fontFamily={MONO}>
      TODAY
    </text>
    <line x1={12} x2={408} y1={22} y2={22} stroke={SILVER} strokeWidth={0.8} />
    <g stroke={WARN} strokeWidth={1} fill="none">
      <path d="M 14 36 a 3 3 0 0 1 6 0" />
      <line x1={12} x2={22} y1={36} y2={36} />
    </g>
    <text x={28} y={38} fontSize={6.5} letterSpacing={1} fill={MUTED} fontFamily={MONO}>
      BEFORE THE OPEN
    </text>
    {[
      { x: 12, t: 'CVX', mv: '±6.3%', ink: INK, set: 'CONFIRMED', setInk: MUTED },
      { x: 212, t: 'NIO', mv: '±22.9%', ink: WARN, set: 'ESTIMATED', setInk: WARN },
    ].map(d => (
      <g key={d.t}>
        <rect x={d.x} y={44} width={196} height={46} rx={4} fill="#0c0c0c" stroke="#1c1c1c" />
        <rect x={d.x + 88} y={49} width={20} height={20} rx={4} fill="#1f1f1f" stroke="#2a2a2a" strokeWidth={0.6} />
        <text x={d.x + 98} y={63} textAnchor="middle" fontSize={6} fontWeight={700} fill={INK} fontFamily={MONO}>
          {d.t}
        </text>
        <text x={d.x + 98} y={78} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={INK} fontFamily={MONO}>
          {d.t}
        </text>
        <text x={d.x + 98} y={87} textAnchor="middle" fontSize={7} fill={d.ink} fontFamily={MONO}>
          {d.mv}
        </text>
      </g>
    ))}
  </Figure>
);

/* A day on the list: the date rail, two doors, a macro chip */
const DayFigure = () => (
  <Figure label="One day of the list: the date on the left in silver as today, two name doors with their options price and slot mark, a CPI chip" h={62}>
    <rect x={0} y={0} width={420} height={62} fill={SILVER} fillOpacity={0.04} />
    <rect x={0} y={0} width={2} height={62} fill={SILVER} fillOpacity={0.7} />
    <text x={14} y={28} fontSize={13} fontWeight={700} fill={SILVER} fontFamily={MONO}>
      Sep 9
    </text>
    <text x={14} y={42} fontSize={6.5} letterSpacing={1} fill={SILVER} fontFamily={MONO}>
      TODAY
    </text>
    <line x1={80} x2={80} y1={0} y2={62} stroke="#ffffff" strokeOpacity={0.08} />
    {[
      { x: 96, t: 'CVX', name: 'Chevron', mv: '±6.3%', ink: INK, slot: 'moon' },
      { x: 220, t: 'NIO', name: 'NIO', mv: '±22.9%', ink: WARN, slot: 'sun' },
    ].map(d => (
      <g key={d.t}>
        <rect x={d.x} y={12} width={20} height={20} rx={4} fill="#1f1f1f" stroke="#2a2a2a" strokeWidth={0.6} />
        <text x={d.x + 10} y={26} textAnchor="middle" fontSize={6} fontWeight={700} fill={INK} fontFamily={MONO}>
          {d.t}
        </text>
        <text x={d.x + 28} y={22} fontSize={9} fontWeight={700} fill={INK} fontFamily={MONO}>
          {d.t}
        </text>
        <text x={d.x + 56} y={22} fontSize={8} fill={d.ink} fontFamily={MONO}>
          {d.mv}
        </text>
        {d.slot === 'moon' ? (
          <path d={`M ${d.x + 96} 15 a 5 5 0 1 0 5 6 a 3.6 3.6 0 0 1 -5 -6 Z`} fill="none" stroke="#8EA2F5" strokeWidth={1} />
        ) : (
          <g stroke={WARN} strokeWidth={1} fill="none">
            <path d={`M ${d.x + 92} 22 a 4 4 0 0 1 8 0`} />
            <line x1={d.x + 90} x2={d.x + 102} y1={22} y2={22} />
          </g>
        )}
        <text x={d.x + 28} y={34} fontSize={6.5} fill={MUTED} fontFamily={SANS}>
          {d.name}
        </text>
      </g>
    ))}
    <rect x={352} y={13} width={40} height={18} rx={4} fill="#0c0c0c" stroke="#1c1c1c" />
    <text x={372} y={25} textAnchor="middle" fontSize={6.5} letterSpacing={1} fill="#a3a3a3" fontFamily={MONO}>
      CPI
    </text>
  </Figure>
);

/* Priced: the options price against the usual move, as a multiple with a word */
const PricedFigure = () => (
  <Figure label="Three names: the options price as a bar against the usual move, the multiple and its word — rich in amber, fair in white, cheap in green" h={84}>
    <g fontFamily={MONO} fontSize={6.5} fill={MUTED} letterSpacing={0.6}>
      <text x={10} y={12}>NAME</text>
      <text x={70} y={12}>OPTIONS PRICE</text>
      <text x={210} y={12}>USUALLY MOVES</text>
      <text x={340} y={12}>PRICED</text>
    </g>
    {[
      { y: 30, t: 'NIO', imp: 22.9, usual: 13.3, x: 1.72, word: 'rich', ink: WARN },
      { y: 50, t: 'CVX', imp: 6.3, usual: 6.0, x: 1.05, word: 'fair', ink: INK },
      { y: 70, t: 'AMZN', imp: 5.1, usual: 7.2, x: 0.71, word: 'cheap', ink: BULL },
    ].map(r => (
      <g key={r.t}>
        <text x={10} y={r.y + 3} fontSize={8.5} fontWeight={700} fill={INK} fontFamily={MONO}>
          {r.t}
        </text>
        <rect x={70} y={r.y - 2} width={120} height={4} rx={2} fill="#ffffff" fillOpacity={0.06} />
        <rect x={70} y={r.y - 2} width={120 * (r.imp / 24)} height={4} rx={2} fill={INK} fillOpacity={0.85} />
        <text x={196} y={r.y + 3} fontSize={7} fill={INK} fontFamily={MONO}>
          ±{r.imp.toFixed(1)}%
        </text>
        <rect x={210} y={r.y - 2} width={100} height={4} rx={2} fill="#ffffff" fillOpacity={0.06} />
        <rect x={210} y={r.y - 2} width={100 * (r.usual / 24)} height={4} rx={2} fill="#ffffff" fillOpacity={0.3} />
        <text x={316} y={r.y + 3} fontSize={7} fill="#a3a3a3" fontFamily={MONO}>
          ±{r.usual.toFixed(1)}%
        </text>
        <text x={340} y={r.y + 3} fontSize={8.5} fontWeight={700} fill={r.ink} fontFamily={MONO}>
          {r.x.toFixed(2)}×
        </text>
        <text x={376} y={r.y + 3} fontSize={6} letterSpacing={1} fill={r.ink} fontFamily={MONO}>
          {r.word.toUpperCase()}
        </text>
      </g>
    ))}
  </Figure>
);

/* Today's price replayed: bars from a line, green covered it, red fell short */
const ReplayFigure = () => {
  const bars = [-0.9, 1.3, 0.3, -0.5, -1.1, 0.9, -0.2, -0.6];
  return (
    <Figure label="Eight bars from a centre line, one per past print: green above covered today's price, red below fell short — here four of eight" h={96}>
      <line x1={90} x2={410} y1={48} y2={48} stroke="#ffffff" strokeOpacity={0.25} />
      <text x={10} y={44} fontSize={6.5} letterSpacing={1} fill={MUTED} fontFamily={MONO}>
        COVERED IT
      </text>
      <text x={10} y={56} fontSize={6.5} letterSpacing={1} fill={MUTED} fontFamily={MONO}>
        FELL SHORT
      </text>
      {bars.map((b, i) => {
        const x = 104 + i * 38;
        const h = Math.abs(b) * 28;
        return <rect key={i} x={x} y={b >= 0 ? 48 - h : 48} width={14} height={Math.max(3, h)} rx={1.5} fill={b >= 0 ? BULL : BEAR} fillOpacity={b >= 0 ? 0.9 : 0.8} />;
      })}
      {['Q4', 'Q1', 'Q2', 'Q3', 'Q4', 'Q1', 'Q2', 'Q3'].map((q, i) => (
        <text key={i} x={111 + i * 38} y={90} textAnchor="middle" fontSize={6.5} fill={MUTED} fontFamily={MONO}>
          {q}
        </text>
      ))}
    </Figure>
  );
};

/* On the record: an insider row and a Congress row */
const RecordFigure = () => (
  <Figure label="Two rows: an insider who bought, chosen; a member of Congress who sold in a bracket, late" h={62}>
    <g fontFamily={MONO} fontSize={6.5} fill={MUTED} letterSpacing={0.6}>
      <text x={10} y={12}>INSIDERS</text>
      <text x={220} y={12}>CONGRESS</text>
    </g>
    <text x={10} y={32} fontSize={8} fontWeight={600} fill={INK} fontFamily={SANS}>
      R. Adeyemi
    </text>
    <text x={10} y={42} fontSize={6.5} fill={MUTED} fontFamily={SANS}>
      CFO · 12d ago
    </text>
    <text x={90} y={32} fontSize={7.5} fill={BULL} fontFamily={MONO}>
      Bought
    </text>
    <text x={130} y={32} fontSize={7.5} fontWeight={600} fill={INK} fontFamily={MONO}>
      $1.2M
    </text>
    <text x={170} y={32} fontSize={5.5} letterSpacing={1} fontWeight={700} fill={INK} fontFamily={MONO}>
      CHOSEN
    </text>
    <line x1={205} x2={205} y1={20} y2={50} stroke="#ffffff" strokeOpacity={0.08} />
    <text x={220} y={32} fontSize={8} fontWeight={600} fill={INK} fontFamily={SANS}>
      Sen. M. Ashford
    </text>
    <text x={220} y={42} fontSize={6.5} fill={MUTED} fontFamily={SANS}>
      D-VT · Finance · own committee
    </text>
    <text x={318} y={32} fontSize={7.5} fill={BEAR} fontFamily={MONO}>
      Sale
    </text>
    <text x={344} y={32} fontSize={7.5} fill={INK} fontFamily={MONO}>
      $50K–$100K
    </text>
    <text x={344} y={42} fontSize={6.5} fill={BEAR} fontFamily={MONO}>
      61d late
    </text>
  </Figure>
);

export const EarningsGuide = () => (
  <div data-earnings-guide>
    <Section title="A day on the board">
      <p>Five days across, today's head in silver; every name is a card with the move its options charge, on the shelf for before the open or after the close. The macro calendar's dates — CPI, FOMC, payrolls — sit under the day's head. Click a card for the name's page.</p>
      <BoardDayFigure />
    </Section>
    <Section title="The same day as a list">
      <p>The Layout card turns the week into a list: dates down the left, today on the silver rail, every name a door, the macro calendar's dates beside them.</p>
      <DayFigure />
    </Section>
    <Section title="Priced">
      <p>The options price over what the name usually moves: rich above 1.3×, cheap below 0.85×, fair between.</p>
      <PricedFigure />
    </Section>
    <Section title="Today's price, replayed">
      <p>On a name's page, today's price for the move is tested against its last eight real prints — how often the move would have covered it.</p>
      <ReplayFigure />
    </Section>
    <Section title="On the record">
      <p>The name's page ends with what its insiders did and what Congress reported in it — the rest of the Record, read for one name.</p>
      <RecordFigure />
    </Section>
  </div>
);

export default EarningsGuide;
