/*
==================================================
  SLAYER TERMINAL - HOW TO READ TRACE
  (components/trace/TraceGuide.tsx)

  The Trace pages' guides in the house pattern: a
  figure per thing, the surface drawn small in its
  own inks, one sentence under each. The figures
  are shared — a contract door, the ink registers,
  the lean bar, the three flow shares — and each
  page assembles its own from them.
==================================================
*/

import type { ReactNode } from 'react';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const SUPREME = 'rgb(var(--supreme))';
const BULL = 'rgb(var(--bull))';
const BEAR = 'rgb(var(--bear))';
const WARN = 'rgb(var(--warn))';
const MUTED = '#7c8290';
const INK = 'rgb(var(--text-primary))';
const SECOND = 'rgb(var(--text-secondary))';
const MONO = 'ui-monospace, Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="px-5 py-4 border-b border-borderSubtle/60 last:border-b-0">
    <h4 className="text-[13px] font-semibold text-textPrimary">{title}</h4>
    <div className="mt-2 text-[12px] leading-relaxed text-textSecondary">{children}</div>
  </section>
);

export const Figure = ({ children, label, h = 110 }: { children: ReactNode; label: string; h?: number }) => (
  <figure data-theme="dark" className="mt-3 rounded-md border border-borderSubtle/60 bg-panel p-2">
    <svg viewBox={`0 0 420 ${h}`} width="100%" role="img" aria-label={label} data-guide-figure>
      {children}
    </svg>
  </figure>
);

const Head = ({ x, y, children, anchor = 'start' }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end' }) => (
  <text x={x} y={y} textAnchor={anchor} fontSize={6} letterSpacing={0.8} fill={MUTED} fontFamily={MONO}>
    {children}
  </text>
);

/* ---- the shared figures ---------------------------------------------------------- */

/** A contract cell: the strike, call or put in its ink, the expiry — the white line is the door */
export const ContractFigure = () => (
  <Figure label="A contract cell drawn large: 505 call 09/10 with a white underline, and beside it the words that say the line is the door to the contract's card" h={54}>
    <text x={14} y={30} fontSize={13} fontWeight={700} fill={INK} fontFamily={MONO}>
      505
    </text>
    <text x={44} y={30} fontSize={10} fill={BULL} fontFamily={MONO}>
      call
    </text>
    <text x={70} y={30} fontSize={8} fill={MUTED} fontFamily={MONO}>
      09/10/2026
    </text>
    <line x1={14} x2={128} y1={36} y2={36} stroke={INK} strokeOpacity={0.7} strokeWidth={1} />
    <text x={150} y={30} fontSize={13} fontWeight={700} fill={INK} fontFamily={MONO}>
      497
    </text>
    <text x={180} y={30} fontSize={10} fill={BEAR} fontFamily={MONO}>
      put
    </text>
    <text x={200} y={30} fontSize={8} fill={MUTED} fontFamily={MONO}>
      09/11/2026
    </text>
    <line x1={150} x2={258} y1={36} y2={36} stroke={INK} strokeOpacity={0.7} strokeWidth={1} />
    <text x={290} y={27} fontSize={7} fill={SECOND} fontFamily={SANS}>
      the strike, the side in its ink, the expiry;
    </text>
    <text x={290} y={38} fontSize={7} fill={SECOND} fontFamily={SANS}>
      the line under it opens the contract's card
    </text>
  </Figure>
);

/** The ink registers: quiet, heavy, direction, the one supreme */
export const InkFigure = () => (
  <Figure label="Five sample figures in their inks: a quiet grey 8,412; a heavy white 48,210; a green +2,940; a red −8,113; a magenta 274,641 — each with the rule beside it" h={98}>
    {[
      { y: 18, sample: '8,412', ink: SECOND, bold: false, word: "the column's usual run" },
      { y: 36, sample: '48,210', ink: INK, bold: true, word: 'heavy — the top fifth of what is on screen' },
      { y: 54, sample: '+2,940', ink: BULL, bold: false, word: 'a signed figure, once it is heavy' },
      { y: 72, sample: '−8,113', ink: BEAR, bold: false, word: 'the same, leaning the other way' },
      { y: 90, sample: '274,641', ink: SUPREME, bold: true, word: 'the single largest on screen' },
    ].map(r => (
      <g key={r.sample}>
        <text x={80} y={r.y} textAnchor="end" fontSize={9} fontWeight={r.bold ? 700 : 400} fill={r.ink} fontFamily={MONO}>
          {r.sample}
        </text>
        <text x={96} y={r.y} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

/** The lean bar: how much of a contract's volume printed at the ask against the bid */
export const LeanFigure = () => (
  <Figure label="Three lean bars: ASK 74% mostly green, MID split, BID 66% mostly red — with the words: at the ask means buyers paid up, at the bid means sellers hit" h={70}>
    {[
      { y: 18, ask: 74, word: 'ASK 74% — three quarters of the volume paid the offer: buyers lifting' },
      { y: 40, ask: 50, word: 'MID — neither side pressing' },
      { y: 62, ask: 34, word: 'BID 66% — sellers hitting the bid' },
    ].map(r => (
      <g key={r.y}>
        <rect x={12} y={r.y - 3} width={70} height={4} rx={2} fill={BEAR} fillOpacity={0.8} />
        <rect x={12} y={r.y - 3} width={70 * (r.ask / 100)} height={4} rx={2} fill={BULL} />
        <text x={90} y={r.y + 1} fontSize={6.5} letterSpacing={0.8} fill={r.ask > 55 ? BULL : r.ask < 45 ? BEAR : SECOND} fontFamily={MONO}>
          {r.ask > 55 ? `ASK ${r.ask}%` : r.ask < 45 ? `BID ${100 - r.ask}%` : 'MID'}
        </text>
        <text x={140} y={r.y + 1} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

/** Sweep, floor, multi: the three shares of a contract's volume */
export const FlowSharesFigure = () => (
  <Figure label="Three columns of shares: SWEEP 64% in white as heavy, FLOOR 23%, MULTI 31% — each with what it counts" h={62}>
    <Head x={14} y={12}>SWEEP</Head>
    <Head x={150} y={12}>FLOOR</Head>
    <Head x={290} y={12}>MULTI</Head>
    <text x={14} y={30} fontSize={11} fontWeight={700} fill={INK} fontFamily={MONO}>
      64%
    </text>
    <text x={14} y={44} fontSize={6.5} fill={SECOND} fontFamily={SANS}>
      of the volume swept across exchanges —
    </text>
    <text x={14} y={53} fontSize={6.5} fill={SECOND} fontFamily={SANS}>
      urgency, taking every offer at once
    </text>
    <text x={150} y={30} fontSize={11} fill={SECOND} fontFamily={MONO}>
      23%
    </text>
    <text x={150} y={44} fontSize={6.5} fill={SECOND} fontFamily={SANS}>
      printed on the floor — worked orders,
    </text>
    <text x={150} y={53} fontSize={6.5} fill={SECOND} fontFamily={SANS}>
      usually institutional size
    </text>
    <text x={290} y={30} fontSize={11} fill={SECOND} fontFamily={MONO}>
      31%
    </text>
    <text x={290} y={44} fontSize={6.5} fill={SECOND} fontFamily={SANS}>
      part of a multi-leg structure —
    </text>
    <text x={290} y={53} fontSize={6.5} fill={SECOND} fontFamily={SANS}>
      a spread, not a naked bet
    </text>
  </Figure>
);

/** Open interest against volume: what was built today */
export const VolOverOiFigure = () => (
  <Figure label="Two contracts: one with volume 12,000 over open interest 5,400 reading 2.22 in bold, positions built today; one with 3,100 over 40,000 reading 0.08 grey, old positions" h={62}>
    {[
      { y: 22, vol: '12,000', oi: '5,400', ratio: '2.22', bold: true, word: 'volume past the interest — positions BUILT today' },
      { y: 48, vol: '3,100', oi: '40,000', ratio: '0.08', bold: false, word: 'a trickle against a large standing position' },
    ].map(r => (
      <g key={r.y}>
        <Head x={14} y={r.y - 10}>VOL</Head>
        <text x={14} y={r.y + 2} fontSize={9} fill={INK} fontFamily={MONO}>
          {r.vol}
        </text>
        <Head x={70} y={r.y - 10}>OI</Head>
        <text x={70} y={r.y + 2} fontSize={9} fill={SECOND} fontFamily={MONO}>
          {r.oi}
        </text>
        <Head x={130} y={r.y - 10}>VOL/OI</Head>
        <text x={130} y={r.y + 2} fontSize={9} fontWeight={r.bold ? 700 : 400} fill={r.bold ? INK : SECOND} fontFamily={MONO}>
          {r.ratio}
        </text>
        <text x={190} y={r.y + 2} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

/** The watch star at the left of a row */
export const WatchFigure = () => (
  <Figure label="A row's left edge with a bookmark mark, hollow at rest and filled in silver when the contract is under watch" h={40}>
    <path d="M 16 12 h 8 v 18 l -4 -3 l -4 3 Z" fill="none" stroke={MUTED} strokeWidth={1} />
    <text x={34} y={24} fontSize={7} fill={SECOND} fontFamily={SANS}>
      at rest
    </text>
    <path d="M 110 12 h 8 v 18 l -4 -3 l -4 3 Z" fill={SILVER} stroke={SILVER} strokeWidth={1} />
    <text x={128} y={24} fontSize={7} fill={SECOND} fontFamily={SANS}>
      under watch — it lands on the Tracker with what it has done since
    </text>
  </Figure>
);

/* ---- the pages ------------------------------------------------------------------ */

export const ScreenerGuide = () => (
  <div data-trace-guide="screener">
    <Section title="A contract">
      <p>Every contract that traded today, one per row; the strike and side are the door to its card.</p>
      <ContractFigure />
    </Section>
    <Section title="The inks">
      <p>Each column measures its own crowd: the bulk quiet, the top fifth heavy, one magenta champion.</p>
      <InkFigure />
    </Section>
    <Section title="Built today">
      <p>Volume over open interest above one and a half means positions were opened today, not turned over.</p>
      <VolOverOiFigure />
    </Section>
    <Section title="Sweep, floor, multi">
      <p>How the volume printed: swept in a hurry, worked on the floor, or as a leg of a structure.</p>
      <FlowSharesFigure />
    </Section>
    <Section title="Lean">
      <p>Whether the volume paid the ask or hit the bid — buyers pressing or sellers.</p>
      <LeanFigure />
    </Section>
  </div>
);

/* ---- footprints ----------------------------------------------------------------- */

/** Open interest overnight: what stood, what stands, the change, who built it */
export const OiChangeFigure = () => (
  <Figure label="One contract's open interest: yesterday 576,487, today 681,730, the change +105,243 +18% in bold green, built on ASK 66% as a lean bar" h={58}>
    <Head x={14} y={12}>PREV OI</Head>
    <Head x={110} y={12}>OI</Head>
    <Head x={200} y={12}>ΔOI</Head>
    <Head x={290} y={12}>ΔOI %</Head>
    <Head x={344} y={12}>BUILT ON</Head>
    <text x={14} y={36} fontSize={10} fill={SECOND} fontFamily={MONO}>
      576,487
    </text>
    <text x={110} y={36} fontSize={10} fontWeight={700} fill={INK} fontFamily={MONO}>
      681,730
    </text>
    <text x={200} y={36} fontSize={10} fontWeight={700} fill={BULL} fontFamily={MONO}>
      +105,243
    </text>
    <text x={290} y={36} fontSize={10} fill={BULL} fontFamily={MONO}>
      +18%
    </text>
    <rect x={344} y={31} width={60} height={4} rx={2} fill={BEAR} fillOpacity={0.8} />
    <rect x={344} y={31} width={40} height={4} rx={2} fill={BULL} />
    <text x={344} y={48} fontSize={6} letterSpacing={0.8} fill={BULL} fontFamily={MONO}>
      ASK 66%
    </text>
  </Figure>
);

/** A streak: sessions in a row the interest grew */
export const StreakFigure = () => (
  <Figure label="Two rows of small bars: one growing seven sessions in a row reading 7d in bold, one growing a single session reading 1d in grey" h={54}>
    {[
      { y: 18, n: 7, word: 'grew seven sessions running — a build with legs' },
      { y: 42, n: 1, word: 'grew once — could be anything' },
    ].map(r => (
      <g key={r.y}>
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x={14 + i * 9} y={r.y - 3 - (i < r.n ? i * 0.8 : 0)} width={6} height={6 + (i < r.n ? i * 0.8 : 0)} rx={1} fill={i < r.n ? INK : '#ffffff'} fillOpacity={i < r.n ? 0.8 : 0.08} />
        ))}
        <text x={90} y={r.y + 3} fontSize={9} fontWeight={r.n >= 3 ? 700 : 400} fill={r.n >= 3 ? INK : SECOND} fontFamily={MONO}>
          {r.n}d
        </text>
        <text x={116} y={r.y + 3} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

export const FootprintsGuide = () => (
  <div data-trace-guide="footprints">
    <Section title="What stayed">
      <p>Volume is loud and gone by the close; open interest is what stayed overnight, and this page ranks what was built and unwound.</p>
      <OiChangeFigure />
    </Section>
    <Section title="A contract">
      <p>The strike and side are the door to the contract's card.</p>
      <ContractFigure />
    </Section>
    <Section title="The inks">
      <p>Each column measures its own crowd: the bulk quiet, the top fifth heavy, one magenta champion.</p>
      <InkFigure />
    </Section>
    <Section title="A streak">
      <p>How many sessions in a row the interest has grown — three and up earns weight.</p>
      <StreakFigure />
    </Section>
  </div>
);

/* ---- watchers ---------------------------------------------------------------- */

/** A reason: the desk's dot in its kind's hue, yours as a hollow ring */
export const ReasonFigure = () => (
  <Figure label="Three reasons: a purple dot 'One print carried outsized money', a teal dot 'Kept printing at higher and higher prices', a hollow ring 'Quiet AVGO' one you wrote" h={66}>
    {[
      { y: 18, dot: '#9B8FE8', hollow: false, text: 'One print carried outsized money', who: "the desk's — the hue says which kind" },
      { y: 40, dot: '#6ECFC4', hollow: false, text: 'Kept printing at higher and higher prices', who: 'another kind, another hue' },
      { y: 62, dot: '', hollow: true, text: 'Quiet AVGO · volume ran past the interest', who: 'yours — a hollow ring, your name first' },
    ].map(r => (
      <g key={r.y}>
        {r.hollow ? <circle cx={18} cy={r.y - 2} r={3} fill="none" stroke={SECOND} strokeWidth={1} /> : <circle cx={18} cy={r.y - 2} r={3} fill={r.dot} />}
        <text x={28} y={r.y + 1} fontSize={8} fill={INK} fontFamily={SANS}>
          {r.text}
        </text>
        <text x={260} y={r.y + 1} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.who}
        </text>
      </g>
    ))}
  </Figure>
);

/** The print that tripped the reason, its money, its side */
export const PrintFigure = () => (
  <Figure label="One alert's print: 850 @ $1.24, $105.4K, on the BID in red — the words: the print that tripped the reason, and which side it printed on" h={54}>
    <Head x={14} y={12}>THE PRINT</Head>
    <Head x={130} y={12}>PRINT $</Head>
    <Head x={210} y={12}>SIDE</Head>
    <text x={14} y={34} fontSize={10} fill={INK} fontFamily={MONO}>
      850 <tspan fontSize={8} fill={SECOND}>@ $1.24</tspan>
    </text>
    <text x={130} y={34} fontSize={10} fontWeight={700} fill={INK} fontFamily={MONO}>
      $105.4K
    </text>
    <text x={210} y={34} fontSize={8} fill={BEAR} fontFamily={MONO}>
      BID
    </text>
    <text x={260} y={30} fontSize={7} fill={SECOND} fontFamily={SANS}>
      the exact print that tripped the reason;
    </text>
    <text x={260} y={40} fontSize={7} fill={SECOND} fontFamily={SANS}>
      on the bid it was sold, at the ask bought
    </text>
  </Figure>
);

export const WatchersGuide = () => (
  <div data-trace-guide="watchers">
    <Section title="A reason">
      <p>Why the contract is in front of you, in words — the desk's watchers, or one you wrote behind Your reasons.</p>
      <ReasonFigure />
    </Section>
    <Section title="The print">
      <p>The exact print that tripped the reason, its money, and which side it printed on.</p>
      <PrintFigure />
    </Section>
    <Section title="A contract">
      <p>The strike and side are the door to the contract's card, opened on that print.</p>
      <ContractFigure />
    </Section>
    <Section title="Under watch">
      <p>The mark at a row's left keeps the contract on the Tracker with what it has done since.</p>
      <WatchFigure />
    </Section>
  </div>
);

/* ---- windows -------------------------------------------------------------------- */

/** The day as quarter hours, one lit */
export const DayStripFigure = () => (
  <Figure label="A row of small bars for the day's quarter hours, one lit in silver with its label 22:45–23:00, the newest bar in lime marked live" h={62}>
    {Array.from({ length: 30 }, (_, i) => {
      const h = 6 + ((i * 7) % 11) * 2;
      const lit = i === 22;
      const live = i === 29;
      return <rect key={i} x={14 + i * 12} y={40 - h} width={8} height={h} rx={1} fill={live ? 'rgb(var(--select))' : lit ? SILVER : '#ffffff'} fillOpacity={live || lit ? 0.9 : 0.14} />;
    })}
    <text x={14 + 22 * 12 + 4} y={52} textAnchor="middle" fontSize={6.5} fill={SILVER} fontFamily={MONO}>
      22:45–23:00
    </text>
    <text x={14 + 29 * 12 + 4} y={52} textAnchor="middle" fontSize={6} letterSpacing={0.8} fill="#D2FF00" fontFamily={MONO}>
      NOW
    </text>
    <text x={14} y={56} fontSize={6.5} fill={MUTED} fontFamily={SANS}>
      the day, a bar per quarter hour — click one to read it
    </text>
  </Figure>
);

/** The share of a contract's day that landed in one window */
export const ShareFigure = () => (
  <Figure label="Two contracts' share-of-day bars: one at 61% in magenta reading burst, one at 3% in grey reading a trickle" h={54}>
    {[
      { y: 18, pct: 61, word: 'a BURST — most of its whole day landed right here', ink: SUPREME },
      { y: 42, pct: 3, word: 'a trickle of a busy name', ink: SECOND },
    ].map(r => (
      <g key={r.y}>
        <rect x={14} y={r.y - 3} width={90} height={5} rx={2} fill="#ffffff" fillOpacity={0.08} />
        <rect x={14} y={r.y - 3} width={90 * (r.pct / 100)} height={5} rx={2} fill={r.ink} />
        <text x={112} y={r.y + 2} fontSize={9} fontWeight={r.pct >= 50 ? 700 : 400} fill={r.ink} fontFamily={MONO}>
          {r.pct}%
        </text>
        <text x={144} y={r.y + 2} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

export const WindowsGuide = () => (
  <div data-trace-guide="windows">
    <Section title="A window">
      <p>The day cut into quarter hours; pick one and the box shows what traded inside it, heaviest first.</p>
      <DayStripFigure />
    </Section>
    <Section title="Share of the day">
      <p>How much of a contract's whole day landed in this one window — half or more is a burst.</p>
      <ShareFigure />
    </Section>
    <Section title="Lean">
      <p>Whether the window's volume paid the ask or hit the bid, and the same for the whole day beside it.</p>
      <LeanFigure />
    </Section>
    <Section title="A contract">
      <p>The strike and side are the door to the contract's card.</p>
      <ContractFigure />
    </Section>
  </div>
);

/* ---- multi-leg ------------------------------------------------------------------ */

/** A structure: the shape's dot, the strikes, the legs */
export const StructureFigure = () => (
  <Figure label="Three structures: a blue dot Vertical 72 / 73 ×2, a purple dot Iron condor 30.5 / 31 / 32 / 32.5 ×4, a teal dot Straddle 252.5 ×2" h={70}>
    {[
      { y: 18, dot: '#7EA6F0', kind: 'Vertical', strikes: '72 / 73', legs: '×2', word: 'two strikes, one side — a bounded bet' },
      { y: 40, dot: '#9B8FE8', kind: 'Iron condor', strikes: '30.5 / 31 / 32 / 32.5', legs: '×4', word: 'four strikes — paid to stay in a range' },
      { y: 62, dot: '#6ECFC4', kind: 'Straddle', strikes: '252.5', legs: '×2', word: 'one strike, both sides — a bet on size, not direction' },
    ].map(r => (
      <g key={r.kind}>
        <circle cx={18} cy={r.y - 2} r={3} fill={r.dot} />
        <text x={28} y={r.y + 1} fontSize={8} fill={INK} fontFamily={SANS}>
          {r.kind}
        </text>
        <text x={90} y={r.y + 1} fontSize={8} fontWeight={700} fill={INK} fontFamily={MONO}>
          {r.strikes}
        </text>
        <text x={212} y={r.y + 1} fontSize={8} fill={SECOND} fontFamily={MONO}>
          {r.legs}
        </text>
        <text x={236} y={r.y + 1} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

/** Defined risk: the most it can lose in red, the most it can make in green, uncapped loudest */
export const RiskFigure = () => (
  <Figure label="Three risk pairs: max loss $3.1K red against max profit $35.7K green; max loss $120.4K red against Uncapped in bold green; max loss Uncapped in bold amber against $36.9K green" h={62}>
    <Head x={14} y={12}>MAX LOSS</Head>
    <Head x={110} y={12}>MAX PROFIT</Head>
    {[
      { y: 28, loss: '$3.1K', lossInk: BEAR, lossBold: false, profit: '$35.7K', profitInk: BULL, profitBold: false, word: 'a debit vertical — both ends known' },
      { y: 44, loss: '$120.4K', lossInk: BEAR, lossBold: false, profit: 'Uncapped', profitInk: BULL, profitBold: true, word: 'a straddle bought — the upside has no ceiling' },
      { y: 60, loss: 'Uncapped', lossInk: 'rgb(var(--warn))', lossBold: true, profit: '$36.9K', profitInk: BULL, profitBold: false, word: 'a ratio — the loss has no floor, the loudest word here' },
    ].map(r => (
      <g key={r.y}>
        <text x={14} y={r.y} fontSize={8.5} fontWeight={r.lossBold ? 700 : 400} fill={r.lossInk} fontFamily={MONO}>
          {r.loss}
        </text>
        <text x={110} y={r.y} fontSize={8.5} fontWeight={r.profitBold ? 700 : 400} fill={r.profitInk} fontFamily={MONO}>
          {r.profit}
        </text>
        <text x={190} y={r.y} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

export const StructureGuide = () => (
  <div data-trace-guide="multi-leg">
    <Section title="A structure">
      <p>The tape reconstructed into spreads — the shape, its strikes and how many legs; a row opens the structure with each leg.</p>
      <StructureFigure />
    </Section>
    <Section title="Defined risk">
      <p>The most the structure can lose and make at expiry, and where a side has no limit.</p>
      <RiskFigure />
    </Section>
    <Section title="The inks">
      <p>Each column measures its own crowd: the bulk quiet, the top fifth heavy, one magenta champion.</p>
      <InkFigure />
    </Section>
  </div>
);

/* ---- net flow and 0dte ---------------------------------------------------------- */

/** A row of the board: rank, the name, its net in its ink, the C and P under it */
export const BoardRowFigure = () => (
  <Figure label="Two board rows: 01 GOOGL +$57.9M in magenta with a green bar and C $52.2M · P −$5.6M under it; 15 META −$923.1K in red with a short red bar" h={70}>
    {[
      { y: 16, n: '01', t: 'GOOGL', net: '+$57.9M', ink: SUPREME, bar: 1, bull: true, c: '$52.2M', p: '−$5.6M' },
      { y: 46, n: '15', t: 'META', net: '−$923.1K', ink: BEAR, bar: 0.05, bull: false, c: '$1.1M', p: '$2.0M' },
    ].map(r => (
      <g key={r.t}>
        <text x={14} y={r.y} fontSize={6.5} fill={MUTED} fontFamily={MONO}>
          {r.n}
        </text>
        <text x={34} y={r.y} fontSize={8.5} fontWeight={700} fill={INK} fontFamily={MONO}>
          {r.t}
        </text>
        <text x={190} y={r.y} textAnchor="end" fontSize={8.5} fontWeight={r.ink === SUPREME ? 700 : 400} fill={r.ink} fontFamily={MONO}>
          {r.net}
        </text>
        <rect x={34} y={r.y + 6} width={100} height={2} rx={1} fill="#ffffff" fillOpacity={0.06} />
        <rect x={34} y={r.y + 6} width={100 * r.bar} height={2} rx={1} fill={r.bull ? BULL : BEAR} fillOpacity={0.6} />
        <text x={140} y={r.y + 9} fontSize={6.5} fill={MUTED} fontFamily={MONO}>
          <tspan fill={BULL}>C</tspan> {r.c} · <tspan fill={BEAR}>P</tspan> {r.p}
        </text>
        <text x={230} y={r.y + 4} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.ink === SUPREME ? 'the largest lean on the board — magenta' : 'a quiet lean, the bulk of the board'}
        </text>
      </g>
    ))}
  </Figure>
);

/** The pane's lines: the spot in white, net calls in green, net puts in red, the volume floor */
export const PaneLinesFigure = () => (
  <Figure label="A small chart: a white spot line drifting down, a green net-calls line rising, a red net-puts line flat, small volume bars along the floor with one in magenta" h={96}>
    <polyline points="14,30 60,26 100,34 150,40 200,44 250,52 300,50 350,60 400,58" fill="none" stroke={INK} strokeWidth={1.2} />
    <polyline points="14,64 60,60 100,58 150,52 200,48 250,42 300,40 350,34 400,32" fill="none" stroke={BULL} strokeWidth={1.4} />
    <polyline points="14,70 60,70 100,69 150,70 200,71 250,70 300,72 350,71 400,72" fill="none" stroke={BEAR} strokeWidth={1.2} />
    {Array.from({ length: 40 }, (_, i) => (
      <rect key={i} x={14 + i * 9.7} y={90 - (3 + ((i * 7) % 9))} width={3} height={3 + ((i * 7) % 9)} fill={i === 11 ? SUPREME : SECOND} fillOpacity={i === 11 ? 0.9 : 0.35} />
    ))}
    <text x={404} y={58} fontSize={6.5} fill={INK} fontFamily={MONO}>
      spot
    </text>
    <text x={404} y={32} fontSize={6.5} fill={BULL} fontFamily={MONO}>
      calls
    </text>
    <text x={404} y={74} fontSize={6.5} fill={BEAR} fontFamily={MONO}>
      puts
    </text>
    <text x={14} y={14} fontSize={7} fill={SECOND} fontFamily={SANS}>
      the name's own candles as the white line; net call and put premium as the green and red; the floor is volume, its largest bar magenta
    </text>
  </Figure>
);

export const NetFlowGuide = () => (
  <div data-trace-guide="net-flow">
    <Section title="The board">
      <p>Every name ranked by net premium — calls bought and puts sold against the reverse; a click puts the name on the pane.</p>
      <BoardRowFigure />
    </Section>
    <Section title="The pane">
      <p>The picked name through the session: its spot, its net calls and puts, the volume on the floor — cut by money and by clock in the cards.</p>
      <PaneLinesFigure />
    </Section>
    <Section title="The inks">
      <p>The bulk of the board quiet, the loud fifth in its direction, the single largest lean in magenta.</p>
      <InkFigure />
    </Section>
  </div>
);

/** Four panes, each with its own cut */
export const DeskFigure = () => (
  <Figure label="Four small panes in a two-by-two grid, each labelled: Everything, SPY, QQQ, Stocks only" h={96}>
    {[
      { x: 14, y: 12, l: 'Everything' },
      { x: 214, y: 12, l: 'SPY' },
      { x: 14, y: 54, l: 'QQQ' },
      { x: 214, y: 54, l: 'Stocks only' },
    ].map(p => (
      <g key={p.l}>
        <rect x={p.x} y={p.y} width={192} height={36} rx={3} fill="#0f0f0f" stroke="#2a2a2a" strokeWidth={0.6} />
        <text x={p.x + 6} y={p.y + 11} fontSize={6.5} fill={INK} fontFamily={MONO}>
          {p.l}
        </text>
        <polyline points={`${p.x + 6},${p.y + 30} ${p.x + 50},${p.y + 26} ${p.x + 100},${p.y + 22} ${p.x + 150},${p.y + 18} ${p.x + 186},${p.y + 16}`} fill="none" stroke={BULL} strokeWidth={1} />
        <polyline points={`${p.x + 6},${p.y + 20} ${p.x + 50},${p.y + 23} ${p.x + 100},${p.y + 26} ${p.x + 150},${p.y + 28} ${p.x + 186},${p.y + 30}`} fill="none" stroke={INK} strokeWidth={0.8} />
      </g>
    ))}
  </Figure>
);

export const OdteGuide = () => (
  <div data-trace-guide="odte">
    <Section title="The desk">
      <p>One to four panes of the same-day book, each with its own cut of the book or one name, its own money and clock; a pane's arrow opens it full screen.</p>
      <DeskFigure />
    </Section>
    <Section title="A pane">
      <p>The spot, the net calls and puts, and the volume on the floor, through the session.</p>
      <PaneLinesFigure />
    </Section>
    <Section title="The inks">
      <p>The floor's bars measure their own crowd: the bulk quiet, the largest in magenta.</p>
      <InkFigure />
    </Section>
  </div>
);

/* ---- live tape ----------------------------------------------------------------- */

/** One row of the tape: when, the name, the contract, size at the fill, the dollars, the tag */
export const TapeRowFigure = () => (
  <Figure label="One tape row: 18:16:04 · NVDA · 120C 19 Sep · 850 @ $1.24 · $105.4K in bold · SWEEP in amber" h={54}>
    <Head x={14} y={12}>TIME</Head>
    <Head x={74} y={12}>TICKER</Head>
    <Head x={126} y={12}>CONTRACT</Head>
    <Head x={222} y={12}>SIZE · FILL</Head>
    <Head x={306} y={12}>PREM</Head>
    <Head x={372} y={12}>TAG</Head>
    <text x={14} y={34} fontSize={9} fill={SECOND} fontFamily={MONO}>
      18:16:04
    </text>
    <text x={74} y={34} fontSize={9} fontWeight={700} fill={INK} fontFamily={MONO}>
      NVDA
    </text>
    <text x={126} y={34} fontSize={9} fill={INK} fontFamily={MONO}>
      120<tspan fill={BULL}>C</tspan> <tspan fill={SECOND} fontSize={8}>19 Sep</tspan>
    </text>
    <text x={222} y={34} fontSize={9} fill={INK} fontFamily={MONO}>
      850 <tspan fill={SECOND} fontSize={8}>@ $1.24</tspan>
    </text>
    <text x={306} y={34} fontSize={9} fontWeight={700} fill={INK} fontFamily={MONO}>
      $105.4K
    </text>
    <text x={372} y={34} fontSize={8} fontWeight={600} fill={WARN} fontFamily={MONO}>
      SWEEP
    </text>
  </Figure>
);

/** Where the fill landed between the bid and the ask */
export const FillFigure = () => (
  <Figure label="Two fills with their markets: $1.28 marked ask over a 1.20 by 1.28 quote with the dot at the offer; $1.20 marked bid over the same quote with the dot at the bid" h={76}>
    {[
      { y: 22, pos: 0.93, price: '1.28', side: 'ASK', word: 'paid the offer — someone wanted it now' },
      { y: 54, pos: 0.07, price: '1.20', side: 'BID', word: 'hit the bid — someone took what was there' },
    ].map(r => (
      <g key={r.y}>
        <text x={14} y={r.y - 5} fontSize={9} fontWeight={700} fill={INK} fontFamily={MONO}>
          ${r.price}
        </text>
        <text x={46} y={r.y - 5} fontSize={7} fontWeight={600} fill={INK} fontFamily={MONO}>
          {r.side}
        </text>
        <text x={14} y={r.y + 9} fontSize={7} fill={SECOND} fontFamily={MONO}>
          1.20
        </text>
        <rect x={38} y={r.y + 4.5} width={54} height={3} rx={1.5} fill="#ffffff" fillOpacity={0.08} />
        <circle cx={38 + 54 * r.pos} cy={r.y + 6} r={3.5} fill={INK} />
        <text x={98} y={r.y + 9} fontSize={7} fill={SECOND} fontFamily={MONO}>
          1.28
        </text>
        <text x={132} y={r.y + 2} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

/** How hard the aggressor pressed — the bar's reach from the centre */
export const ConvictionFigure = () => (
  <Figure label="Two conviction bars: a long green bar reaching right of centre, and a short red bar left of centre" h={64}>
    {[
      { y: 18, key: 'up', ink: BULL, score: 0.8, word: 'offers lifted, hard — a long bar to the right' },
      { y: 44, key: 'down', ink: BEAR, score: -0.3, word: 'bids hit, gently — a short bar to the left' },
    ].map(r => (
      <g key={r.key}>
        <rect x={14} y={r.y} width={64} height={5} rx={2.5} fill="#ffffff" fillOpacity={0.08} />
        <rect x={45.6} y={r.y - 1} width={0.8} height={7} fill="#ffffff" fillOpacity={0.25} />
        {r.score >= 0 ? (
          <rect x={46} y={r.y} width={32 * r.score} height={5} rx={2.5} fill={r.ink} />
        ) : (
          <rect x={46 + 32 * r.score} y={r.y} width={-32 * r.score} height={5} rx={2.5} fill={r.ink} />
        )}
        <text x={96} y={r.y + 5} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

export const LiveTapeGuide = () => (
  <div data-trace-guide="live-tape">
    <Section title="A print">
      <p>One contract traded once — when, the name, the contract, how many at what price, the dollars, and its tag.</p>
      <TapeRowFigure />
    </Section>
    <Section title="Fill &amp; market">
      <p>
        What was paid, the side it crossed as a word, and under it the bid and ask it crossed into. A fill sitting on the
        offer of a 1.20 × 1.28 market is its own argument that somebody wanted it now.
      </p>
      <FillFigure />
    </Section>
    <Section title="Conviction">
      <p>How hard the aggressor pressed — the bar's reach from the centre, right for offers lifted, left for bids hit.</p>
      <ConvictionFigure />
    </Section>
    <Section title="The inks">
      <p>Premium quiet below $250K, bold above, the largest print on the tape in magenta.</p>
      <InkFigure />
    </Section>
  </div>
);

/* ---- tracker ------------------------------------------------------------------- */

/** What a mark has done since: the fill then and now, the change in its ink */
export const SinceFigure = () => (
  <Figure label="Two marked contracts: NVDA 120C marked at $3.29 now $4.10 reading +24.6% in green; SPY 494P marked at $4.73 now $3.90 reading −17.5% in red" h={66}>
    <Head x={14} y={12}>MARKED AT</Head>
    <Head x={110} y={12}>NOW</Head>
    <Head x={190} y={12}>SINCE</Head>
    {[
      { y: 30, then: '$3.29', now: '$4.10', chg: '+24.6%', ink: BULL, word: 'the fill has climbed since the mark' },
      { y: 52, then: '$4.73', now: '$3.90', chg: '−17.5%', ink: BEAR, word: 'the fill has slipped' },
    ].map(r => (
      <g key={r.y}>
        <text x={14} y={r.y} fontSize={9} fill={SECOND} fontFamily={MONO}>
          {r.then}
        </text>
        <text x={110} y={r.y} fontSize={9} fill={INK} fontFamily={MONO}>
          {r.now}
        </text>
        <text x={190} y={r.y} fontSize={9} fontWeight={700} fill={r.ink} fontFamily={MONO}>
          {r.chg}
        </text>
        <text x={260} y={r.y} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

export const TrackerGuide = () => (
  <div data-trace-guide="tracker">
    <Section title="A mark">
      <p>The mark at the left of any Trace row keeps the contract, print or structure here.</p>
      <WatchFigure />
    </Section>
    <Section title="Since">
      <p>What it has done since you marked it — the fill, the volume, the open interest and the lean, then against now.</p>
      <SinceFigure />
    </Section>
    <Section title="A contract">
      <p>The strike and side are the door to the contract's card, opened on the print you marked.</p>
      <ContractFigure />
    </Section>
  </div>
);

/* ---- dark pool ---------------------------------------------------------------- */

/** A shelf: the price, its role in its ink, the bar of the session's dark dollars that rested there */
export const ShelfFigure = () => (
  <Figure label="A liquidity shelf: the role, the price, the share bar and how many times price bounced off it" h={96}>
    <Head x={12} y={14}>ROLE</Head>
    <Head x={92} y={14}>PRICE</Head>
    <Head x={168} y={14}>FROM SPOT</Head>
    <Head x={408} y={14} anchor="end">DARK $</Head>
    {[
      { y: 34, role: 'RESISTANCE', ink: BEAR, price: '507.40', dist: '+0.71%', usd: '$182.0M', w: 210, note: 'defended 2×' },
      { y: 58, role: 'PIVOT', ink: WARN, price: '503.85', dist: '+0.01%', usd: '$96.4M', w: 112, note: 'untested' },
      { y: 82, role: 'SUPPORT', ink: BULL, price: '499.10', dist: '−0.93%', usd: '$141.3M', w: 164, note: 'defended 3×' },
    ].map(r => (
      <g key={r.role}>
        <text x={12} y={r.y} fontSize={7} fontFamily={MONO} fontWeight={600} letterSpacing={0.6} fill={r.ink}>
          {r.role}
        </text>
        <text x={92} y={r.y} fontSize={9} fontFamily={MONO} fontWeight={700} fill={INK}>
          ${r.price}
        </text>
        <text x={168} y={r.y} fontSize={7} fontFamily={MONO} fill={r.dist.startsWith('+') ? BULL : BEAR}>
          {r.dist}
        </text>
        <rect x={224} y={r.y - 6} width={120} height={3} rx={1.5} fill="rgba(237,237,237,0.06)" />
        <rect x={224} y={r.y - 6} width={(r.w / 210) * 120} height={3} rx={1.5} fill={r.ink} opacity={0.7} />
        <text x={408} y={r.y} fontSize={8} fontFamily={MONO} fill={INK} textAnchor="end">
          {r.usd}
        </text>
        <text x={224} y={r.y + 8} fontSize={6} fontFamily={MONO} fill={SECOND}>
          {r.note}
        </text>
      </g>
    ))}
  </Figure>
);

/** A cross with its read: the size at the price, the intent in its ink, the classifier's bar */
export const CrossFigure = () => (
  <Figure label="A dark-pool cross: the shares at the price, the read in its ink, and how sure the classifier is" h={70}>
    <Head x={12} y={14}>TIME</Head>
    <Head x={64} y={14}>PRICE</Head>
    <Head x={132} y={14}>SHARES</Head>
    <Head x={214} y={14}>READ</Head>
    <Head x={318} y={14}>CONVICTION</Head>
    {[
      { y: 36, t: '14:12', px: '499.12', sh: '640,000', read: 'ACCUMULATION', ink: BULL, c: 84 },
      { y: 58, t: '13:47', px: '507.36', sh: '210,000', read: 'HEDGE FLOW', ink: WARN, c: 56 },
    ].map(r => (
      <g key={r.t}>
        <text x={12} y={r.y} fontSize={8} fontFamily={MONO} fill={INK}>
          {r.t}
        </text>
        <text x={64} y={r.y} fontSize={9} fontFamily={MONO} fontWeight={700} fill={INK}>
          ${r.px}
        </text>
        <text x={132} y={r.y} fontSize={8} fontFamily={MONO} fill={INK}>
          {r.sh}
        </text>
        <text x={214} y={r.y} fontSize={7} fontFamily={MONO} fontWeight={600} letterSpacing={0.6} fill={r.ink}>
          {r.read}
        </text>
        <rect x={318} y={r.y - 5} width={56} height={3} rx={1.5} fill="rgba(237,237,237,0.06)" />
        <rect x={318} y={r.y - 5} width={(r.c / 100) * 56} height={3} rx={1.5} fill={r.ink} opacity={0.8} />
        <text x={384} y={r.y} fontSize={8} fontFamily={MONO} fill={INK}>
          {r.c}%
        </text>
      </g>
    ))}
  </Figure>
);

export const DarkPoolGuide = () => (
  <div data-trace-guide="dark-pool">
    <Section title="Off-exchange">
      <p>A dark-pool cross is size that changed hands away from the lit exchanges — an institution moving a position without showing its hand. The tape shows the print; this page shows the read: who is most likely behind it and what it means for the level it printed at.</p>
      <CrossFigure />
    </Section>
    <Section title="The read">
      <p>
        <span className="text-bull">Accumulation</span> is size bought below the market in an up-tape — someone building. <span className="text-bear">Distribution</span> is size sold into strength while the tape weakens — someone leaving. <span className="text-warn">Hedge flow</span> printed on an options shelf and is most likely a desk hedging, not a bet. Rotation is routine and no signal on its own. The bar is how sure the classifier is.
      </p>
    </Section>
    <Section title="A shelf">
      <p>Where the dark dollars rested through the session. Below the spot a shelf is support, above it resistance, at it a pivot; the bar is its share of the session's dark dollars and the count is how many times price has already bounced off it. A shelf cuts the grid to the crosses that landed on it, and its line says how to trade against it.</p>
      <ShelfFigure />
    </Section>
    <Section title="The posture">
      <p>Net accumulation against distribution across the sized prints, in dollars weighted by conviction — accumulating past +18%, distributing past −18%, balanced between.</p>
    </Section>
  </div>
);

/* ---- compare ------------------------------------------------------------------ */

/** A ledger row: the fact, A's figure, B's figure, the diamond on the side that carries the row */
export const LedgerFigure = () => (
  <Figure label="A ledger row: the fact at the left, the two names' figures at the right, the diamond on the heavier side" h={78}>
    <Head x={12} y={14}>FACT</Head>
    <Head x={300} y={14} anchor="end">SPY</Head>
    <Head x={408} y={14} anchor="end">QQQ</Head>
    {[
      { y: 36, label: 'Net premium', a: '+$4.2M', b: '−$1.1M', aInk: BULL, bInk: BEAR, edge: 'a' },
      { y: 58, label: 'Volume', a: '812,400', b: '1,204,900', aInk: INK, bInk: INK, edge: 'b' },
    ].map(r => (
      <g key={r.label}>
        <text x={12} y={r.y} fontSize={8} fontFamily={MONO} fill={INK}>
          {r.label}
        </text>
        {r.edge === 'a' && (
          <text x={262} y={r.y} fontSize={7} fill="rgb(var(--supreme))">
            ◆
          </text>
        )}
        <text x={300} y={r.y} fontSize={8} fontFamily={MONO} fontWeight={r.edge === 'a' ? 700 : 400} fill={r.aInk} textAnchor="end">
          {r.a}
        </text>
        {r.edge === 'b' && (
          <text x={362} y={r.y} fontSize={7} fill="rgb(var(--supreme))">
            ◆
          </text>
        )}
        <text x={408} y={r.y} fontSize={8} fontFamily={MONO} fontWeight={r.edge === 'b' ? 700 : 400} fill={r.bInk} textAnchor="end">
          {r.b}
        </text>
      </g>
    ))}
  </Figure>
);

export const CompareGuide = () => (
  <div data-trace-guide="compare">
    <Section title="Two names">
      <p>A and B are any two names on today's book — the searches offer exactly those, and the swap turns them around. Everything on the page reads the same cut book the other Trace pages read, so a figure here is the figure there.</p>
    </Section>
    <Section title="The panes">
      <p>Each name's session on the Net Flow pane: its own candles as the spot line, net call and net put premium as the lines. The money and clock cards are shared, so both panes always answer the same question. Under each pane, the same-day money — the 0DTE desk's figures for that name.</p>
      <PaneLinesFigure />
    </Section>
    <Section title="The ledger">
      <p>One row per fact, A against B — net flow, the same-day money, the book, the footprints, the structures, the tape and the calendar. The diamond marks the side that carries the row: the larger figure, or for a lean, the more bullish one.</p>
      <LedgerFigure />
    </Section>
    <Section title="The contracts">
      <p>Each name's heaviest contracts by dollars — a row opens the contract's card — and its structures, the tape reconstructed into spreads, heaviest first.</p>
      <ContractFigure />
    </Section>
  </div>
);

export default ScreenerGuide;
