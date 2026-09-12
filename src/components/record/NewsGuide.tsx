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

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const LIME = 'rgb(var(--select))';
const BULL = 'rgb(var(--bull))';
const BEAR = 'rgb(var(--bear))';
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
    { x: 288, y: 12, label: 'Confidence', value: '80%', ink: INK },
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

/* The drip: live at the right end, pulled back to a minute */
const DripFigure = () => {
  const track = (y: number, at: number, word: string, ink: string) => (
    <g>
      <path d={`M 14 ${y - 4} L 21 ${y} L 14 ${y + 4} Z`} fill="none" stroke={MUTED} strokeWidth={1} strokeLinejoin="round" />
      <text x={32} y={y + 2.5} fontSize={6.5} fill={MUTED} fontFamily={MONO}>
        00:00
      </text>
      <line x1={62} x2={318} y1={y} y2={y} stroke="#ffffff" strokeOpacity={0.12} strokeWidth={2} strokeLinecap="round" />
      <circle cx={62 + 256 * at} cy={y} r={4} fill={SILVER} stroke="#0c0c0c" strokeWidth={1.5} />
      <text x={330} y={y + 2.5} fontSize={6.5} fill={MUTED} fontFamily={MONO}>
        21:11
      </text>
      <text x={408} y={y + 2.5} textAnchor="end" fontSize={6.5} letterSpacing={1} fill={ink} fontFamily={MONO}>
        {word}
      </text>
    </g>
  );
  return (
    <Figure label="The drip bar twice: the thumb at the far right reading LIVE in lime, then pulled back to 09:45 reading AS OF 09:45 in silver" h={52}>
      {track(16, 1, 'LIVE', LIME)}
      {track(38, 0.46, 'AS OF 09:45', SILVER)}
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
    <Section title="The square">
      <p>How hard a story lands, on the wire and on the calendar.</p>
      <SquareFigure />
    </Section>
    <Section title="The story's numbers">
      <p>What the model expects, how sure it is, how much the tape already has, how long it keeps working, and whether the options book agrees.</p>
      <NumbersFigure />
    </Section>
    <Section title="The drip">
      <p>Pull the bar back to any minute of the day; the far right is live.</p>
      <DripFigure />
    </Section>
  </div>
);

export default NewsGuide;
