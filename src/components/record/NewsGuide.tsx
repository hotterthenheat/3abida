/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE WIRE
  (components/record/NewsGuide.tsx)

  The News page's guide in the house pattern: a
  figure per thing, the surface drawn small in its
  own inks, ONE sentence under each (Noah,
  2026-09-09: "waaaay to many words not enough
  high quality images. short and sweet").
==================================================
*/

import type { ReactNode } from 'react';
import NewsMap, { type HeatPoint, type MapNote, type Reach } from './NewsMap';
import type { CityPing } from '../../data/newsroom';

const BULL = 'rgb(var(--bull))';
const BEAR = 'rgb(var(--bear))';
const SILVER = 'rgb(var(--silver))';
const SUPREME = 'rgb(var(--supreme))';
const MUTED = '#7c8290';
const INK = 'rgb(var(--text-primary))';
const MONO = 'ui-monospace, Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';
const IMPACT = { high: '#D73027', medium: '#FDAE61', low: 'rgb(var(--text-muted))' };

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

/* THE MAP FIGURES: the real map, still, in figure mode — the same borders,
   pins, heat, wash and arcs the page draws, so the guide shows the thing
   itself (Noah, 2026-09-09: the drawn ovals were "not matching our high
   quality type design at all"). */
const MapFigure = ({ label, children }: { label: string; children: ReactNode }) => (
  <figure data-theme="dark" className="mt-3 rounded-md border border-borderSubtle/60 bg-panel overflow-hidden" role="img" aria-label={label} data-guide-figure>
    {children}
  </figure>
);
const ping = (city: string, lat: number, lng: number, n: number, grade: CityPing['grade'], freshest: CityPing['freshest'] = 'developing'): CityPing => ({
  city,
  lat,
  lng,
  n,
  threats: grade === 'THREAT' ? n : 0,
  allies: grade === 'ALLY' ? n : 0,
  grade,
  topId: city,
  topHeadline: '',
  maxSeverity: 5,
  freshest,
});
const still = { onPick: () => undefined, onHover: () => undefined, hoverCity: null };
/** A Wednesday at 09:30 UTC — London open, Tokyo and New York closed */
const LONDON_MORNING = new Date('2026-09-09T09:30:00Z');

const PIN_FIGURE = {
  pins: [ping('Santa Clara', 37.35, -121.95, 3, 'ALLY'), ping('Washington', 38.89, -77.04, 1, 'WATCH'), ping('Riyadh', 24.71, 46.68, 2, 'THREAT', 'fresh'), ping('Shanghai', 31.23, 121.47, 1, 'ALLY')],
  notes: [
    { lat: 37.35, lng: -121.95, text: '3 stories · positive', dy: 52 },
    { lat: 38.89, lng: -77.04, text: 'open · neutral', dy: 44 },
    { lat: 24.71, lng: 46.68, text: 'fresh · negative', dy: 52 },
  ] as MapNote[],
};
const PinsFigure = () => (
  <MapFigure label="The map, still: a big green three at Santa Clara, a grey pin with the silver ring at Washington, a red two with a halo at Riyadh, a small green one at Shanghai">
    <NewsMap figure pins={PIN_FIGURE.pins} selectedCity="Washington" heat={[]} reach={null} at={new Date('2026-09-09T22:00:00Z')} notes={PIN_FIGURE.notes} {...still} />
  </MapFigure>
);

const HEAT_FIGURE = {
  pins: [ping('Santa Clara', 37.35, -121.95, 1, 'ALLY')],
  heat: [
    { lat: 40.71, lng: -74.01, w: 30 },
    { lat: 29.76, lng: -95.37, w: 12 },
    { lat: 24.71, lng: 46.68, w: 12 },
    { lat: 25.03, lng: 121.56, w: 14 },
    { lat: 37.56, lng: 126.97, w: 8 },
    { lat: 22.54, lng: 114.06, w: 9 },
    { lat: 51.44, lng: 5.47, w: 6 },
    { lat: 51.51, lng: -0.13, w: 9 },
    { lat: 35.68, lng: 139.69, w: 7 },
  ] as HeatPoint[],
  reach: {
    lat: 37.35,
    lng: -121.95,
    city: 'Santa Clara',
    zones: [
      { lat: 25.03, lng: 121.56, label: 'Taipei · foundries', w: 6 },
      { lat: 37.56, lng: 126.97, label: 'Seoul · memory complex', w: 4 },
      { lat: 51.44, lng: 5.47, label: 'Eindhoven · lithography', w: 3 },
    ],
  } as Reach,
  notes: [
    { lat: 36, lng: -98, text: 'hot · most news lands here', dy: 74 },
    { lat: 25.03, lng: 121.56, text: 'where the open story reaches', dy: 50 },
  ] as MapNote[],
};
const HeatFigure = () => (
  <MapFigure label="The map, still: the United States warmed hottest, Asia and the Gulf warm, a silver wash over Europe reading London open, silver arcs from the open pin at Santa Clara to rings at Taipei, Seoul and Eindhoven">
    <NewsMap figure pins={HEAT_FIGURE.pins} selectedCity="Santa Clara" heat={HEAT_FIGURE.heat} reach={HEAT_FIGURE.reach} at={LONDON_MORNING} notes={HEAT_FIGURE.notes} {...still} />
  </MapFigure>
);

/* The square before a headline */
const SquareFigure = () => (
  <Figure label="Three headlines, each with a square before it: red for high impact, orange for medium, grey for low" h={70}>
    {[
      { y: 16, ink: IMPACT.high, head: 'NVIDIA beats; Blackwell sold out into next year', word: 'high · moves the market' },
      { y: 38, ink: IMPACT.medium, head: 'EU confirms tariffs on China-built EVs', word: 'medium · a name or a sector' },
      { y: 60, ink: IMPACT.low, head: 'UBS upgrades GE Aerospace to Buy', word: 'low · noted' },
    ].map(r => (
      <g key={r.word}>
        <rect x={12} y={r.y - 4} width={8} height={8} rx={2} fill={r.ink} />
        <text x={28} y={r.y + 3} fontSize={7.5} fill={INK} fontFamily={SANS}>
          {r.head}
        </text>
        <text x={408} y={r.y + 3} textAnchor="end" fontSize={6.5} fill={MUTED} fontFamily={MONO}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

/* The story's six figures and the odds bar */
const NumbersFigure = () => {
  const cells = [
    { x: 12, y: 12, label: '1-day expected', value: '+2.1%', ink: BULL },
    { x: 150, y: 12, label: '5-day expected', value: '+3.7%', ink: BULL },
    { x: 288, y: 12, label: 'Confidence', value: 'strong', ink: BULL },
    { x: 12, y: 44, label: 'Already priced in', value: '13%', ink: INK },
    { x: 150, y: 44, label: 'Keeps working', value: '5.5 sessions', ink: INK },
    { x: 288, y: 44, label: 'The options book', value: 'fades it', ink: BEAR },
  ];
  return (
    <Figure label="Six figures in three columns — the expected moves, confidence, priced in, keeps working, the options book — and under them the odds bar, red down against green up" h={96}>
      {cells.map(c => (
        <g key={c.label}>
          <text x={c.x} y={c.y} fontSize={6.5} fill={MUTED} fontFamily={SANS}>
            {c.label}
          </text>
          <text x={c.x} y={c.y + 13} fontSize={9.5} fontWeight={700} fill={c.ink} fontFamily={MONO}>
            {c.value}
          </text>
        </g>
      ))}
      <text x={12} y={80} fontSize={7} fill={BEAR} fontFamily={MONO}>
        down 19%
      </text>
      <text x={210} y={80} textAnchor="middle" fontSize={5.5} letterSpacing={1} fill={MUTED} fontFamily={MONO}>
        ODDS NEXT SESSION
      </text>
      <text x={408} y={80} textAnchor="end" fontSize={7} fontWeight={700} fill={BULL} fontFamily={MONO}>
        up 81%
      </text>
      <rect x={12} y={86} width={396 * 0.19} height={5} rx={2.5} fill={BEAR} fillOpacity={0.8} />
      <rect x={12 + 396 * 0.19} y={86} width={396 * 0.81} height={5} rx={2.5} fill={BULL} />
    </Figure>
  );
};

/* All news: the six tabs with their counts, the hairline under the one in hand, a followed name's chip with its bell */
const TabsFigure = () => {
  const tabs: [string, number, number][] = [
    ['ALL FINANCE · 24', 12, 1],
    ['FOLLOWING · 5', 118, 0],
    ['EARNINGS · 9', 196, 0],
    ['DATA · 4', 272, 0],
    ['ANALYST · 6', 322, 0],
    ['DEALS · 5', 384, 0],
  ];
  return (
    <Figure label="The six tabs in a line, ALL FINANCE · 24 underlined; under them a followed name's chip, NVDA with a silver bell, and the Follow a name door" h={64}>
      {tabs.map(([w, x, on]) => (
        <g key={w}>
          <text x={x} y={18} fontSize={6.5} letterSpacing={0.8} fill={on ? INK : MUTED} fontFamily={MONO}>
            {w}
          </text>
          {on === 1 && <line x1={x} x2={x + 58} y1={23} y2={23} stroke={INK} strokeWidth={1} />}
        </g>
      ))}
      <line x1={0} x2={420} y1={30} y2={30} stroke="#ffffff" strokeOpacity={0.08} />
      <text x={12} y={48} fontSize={6} letterSpacing={1} fill={MUTED} fontFamily={MONO}>
        FOLLOWING
      </text>
      <rect x={56} y={38} width={62} height={16} rx={3} fill="#ffffff" fillOpacity={0.05} stroke="#ffffff" strokeOpacity={0.14} />
      <text x={63} y={49} fontSize={7.5} fontWeight={700} fill={INK} fontFamily={MONO}>
        NVDA
      </text>
      <path d="M 98 43 a 3 3 0 0 1 6 0 v 3 l 1.5 1.5 h -9 l 1.5 -1.5 z" fill={SILVER} />
      <text x={110} y={49.5} fontSize={7} fill={MUTED} fontFamily={MONO}>
        ×
      </text>
      <rect x={126} y={38} width={70} height={16} rx={3} fill="#ffffff" fillOpacity={0.05} stroke="#ffffff" strokeOpacity={0.14} />
      <text x={133} y={49} fontSize={7} fill={INK} fontFamily={MONO}>
        + Follow a name
      </text>
      <text x={408} y={49} textAnchor="end" fontSize={6} fill={MUTED} fontFamily={MONO}>
        the bell rings in the alerts drawer
      </text>
    </Figure>
  );
};

/* The month: three cells — a date, today's number in its round, the pills in their inks, "2 more" */
const MonthFigure = () => {
  const cell = (x: number, day: string, today: boolean, pills: [string, string, string][], more?: number) => (
    <g>
      <rect x={x} y={8} width={130} height={92} fill="none" stroke="#ffffff" strokeOpacity={0.1} />
      {today && <circle cx={x + 16} cy={20} r={8} fill={INK} />}
      <text x={x + 16} y={22.5} textAnchor="middle" fontSize={7.5} fontWeight={today ? 700 : 400} fill={today ? '#0a0a0a' : INK} fontFamily={MONO}>
        {day}
      </text>
      {pills.map(([w, t, ink], i) => (
        <g key={w}>
          <rect x={x + 6} y={32 + i * 19} width={118} height={15} rx={2.5} fill={ink} fillOpacity={0.13} />
          <rect x={x + 6} y={32 + i * 19} width={1.6} height={15} fill={ink} />
          <text x={x + 12} y={42.5 + i * 19} fontSize={6.5} fontWeight={600} fill={ink} fontFamily={MONO}>
            {w}
          </text>
          <text x={x + 120} y={42.5 + i * 19} textAnchor="end" fontSize={5.5} fill={ink} fillOpacity={0.8} fontFamily={MONO}>
            {t}
          </text>
        </g>
      ))}
      {more && (
        <text x={x + 10} y={94} fontSize={6} fill={MUTED} fontFamily={MONO}>
          {more} more
        </text>
      )}
    </g>
  );
  return (
    <Figure label="Three days of the month: the 15th with Retail sales in red and TSM after the close in silver, the 16th today with FOMC in red, UK CPI in orange and 2 more, the 18th with Monthly options expiration in magenta and TSLA" h={108}>
      {cell(6, '15', false, [
        ['Retail sales m/m', '08:30', IMPACT.high],
        ['TSM', 'AMC', SILVER],
        ['WMT', 'AMC', SILVER],
      ])}
      {cell(145, '16', true, [
        ['FOMC rate decision', '14:00', IMPACT.high],
        ['UK CPI y/y', '02:00', IMPACT.medium],
        ['Housing starts', '08:30', IMPACT.low],
      ], 2)}
      {cell(284, '18', false, [
        ['Monthly options expiration', '16:00', SUPREME],
        ['TSLA', 'AMC', SILVER],
      ])}
    </Figure>
  );
};

export const NewsGuide = () => (
  <div data-news-guide>
    <Section title="The pins">
      <p>One pin per city: its size the count, its ink the lean, a halo when a story there is fresh, the silver ring on the open one.</p>
      <PinsFigure />
    </Section>
    <Section title="Heat, reach, sessions">
      <p>The land warms where the news lands, the arcs are where the open story reaches, the wash is the market that is open now.</p>
      <HeatFigure />
    </Section>
    <Section title="The tape, the kinds, the glide">
      <p>The newest headlines cross the top of the map on a loop; it holds still under the pointer, the wheel or a drag pulls it back by hand, and the arrows at its ends step one headline at a time. A story that leaves the tape is still a row below. The pills at the map's foot pull one kind of story up everywhere. Pick a story anywhere — the tape, a pin, a row — and the map glides to its city, flat; Fit brings the world back.</p>
    </Section>
    <Section title="The square">
      <p>How hard a story lands, on the wire and on the calendar.</p>
      <SquareFigure />
    </Section>
    <Section title="The story's numbers">
      <p>What the model expects, how sure it is, how much the tape already has, how long it keeps working, and whether the options book agrees. How sure is said in a word: strong, good, caution or poor.</p>
      <NumbersFigure />
    </Section>
    <Section title="All news">
      <p>Every headline, newest first, a tab per kind with its count. Follow a name and its stories gather on Following; ring its bell and the alerts drawer tells you of each one. A click opens the story beside the map.</p>
      <TabsFigure />
    </Section>
    <Section title="The month">
      <p>Every day with what prints on it: the data in its impact's ink, a name reporting in silver with its slot, the market's own dates in magenta. Open a day for its figures; the arrows walk the months and Today comes home.</p>
      <MonthFigure />
    </Section>
  </div>
);

export default NewsGuide;
