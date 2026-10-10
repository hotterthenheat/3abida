/*
==================================================
  SLAYER TERMINAL - HOW TO READ WHAT'S BEING BUILT
  (components/gex/BuildingGuide.tsx)

  The guide for the Building page, in the house
  pattern (a focus-and-blur card, figures drawn in
  the surface's own grammar, one or two sentences
  each, "Today" from the numbers on screen).
==================================================
*/

import type { ReactNode } from 'react';
import { BULL, CALL_WALL, FLIP, PUT_WALL, SUPREME, alpha } from './paletteInk';
import { fmtDollars, fmtStrike, type AheadClock } from '../../data/ahead';
import type { Building } from '../../data/building';
import { FONT_SANS } from '../../theme/fonts';
import { GuideSvg, type GuideType } from '../ui/GuideSvg';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
/* the figures' voice — Helvetica's digits are tabular (theme/fonts.ts) */
const FIG = FONT_SANS;
const SANS = FONT_SANS;

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="px-5 py-4 border-b border-borderSubtle/60 last:border-b-0">
    <h4 className="text-[13px] font-semibold text-textPrimary">{title}</h4>
    <div className="mt-2 text-[12px] leading-relaxed text-textSecondary">{children}</div>
  </section>
);

const Figure = ({ children, label, h = 110 }: { children: (t: GuideType) => ReactNode; label: string; h?: number }) => (
  <figure data-theme="dark" className="mt-3 rounded-md border border-borderSubtle/60 bg-panel p-2">
    <GuideSvg w={420} h={h} label={label}>
      {children}
    </GuideSvg>
  </figure>
);

/* THE ROWS, DRAWN SMALL (redrawn 2026-09-13 with the box): three movers the
   way the box draws them — the strike with its tag and its distance from
   spot, the wall bar with today's part lit, the change, the day's line, the
   verdict chip with its words — a folded line of steady strikes and the spot
   rule between. Every part is one the reader can find behind the card. */
const LedgerFigure = () => {
  /* three lines a row since the words came up to 11 px (2026-10-10): the strike, the bar, the change, the day and the
     verdict on the first; the distance, the wall's figure and the verdict's words on the second; the bar's read under */
  const COL = { strike: 10, bar: 120, barW: 78, change: 262, day: 272, dayW: 30, word: 320 };
  type Row = { y: number; strike: string; dist: string; tag?: { text: string; ink: string }; base: number; lit: number; gone: boolean; now: string; was?: string; change: string; chip: string; tone: string; words: string; day: 'up' | 'down' };
  const rows: Row[] = [
    { y: 38, strike: '487', dist: '0.3% above', tag: { text: 'Call wall', ink: CALL_WALL }, base: 44, lit: 19, gone: false, now: '$190M', was: '$165M', change: '+$25M', chip: 'Building', tone: BULL, words: 'calls · mostly early', day: 'up' },
    { y: 132, strike: '485', dist: '0.1% below', tag: { text: 'Put wall', ink: PUT_WALL }, base: 59, lit: 14, gone: true, now: '$226M', was: '$244M', change: '−$18M', chip: 'Draining', tone: PUT_WALL, words: 'puts · mostly late', day: 'down' },
    { y: 184, strike: '484', dist: '0.3% below', base: 13, lit: 26, gone: false, now: '$40M', was: '$14M', change: '+$26M', chip: 'Building', tone: BULL, words: 'puts · mostly midday', day: 'up' },
  ];
  const dayLine = (kind: Row['day'], y: number) => {
    const x0 = COL.day;
    const pts = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      const wig = ((i * 7) % 3) - 1;
      const base = kind === 'up' ? 5 - t * 10 : -5 + t * 10;
      return [x0 + t * COL.dayW, y + base + wig * 0.8] as const;
    });
    const path = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`);
    const tint = kind === 'up' ? BULL : PUT_WALL;
    return (
      <g>
        <polyline points={path.join(' ')} fill="none" stroke="#8a909c" strokeWidth={1} strokeLinejoin="round" />
        <polyline points={path.slice(3, 7).join(' ')} fill="none" stroke={tint} strokeOpacity={0.85} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[8][0]} cy={pts[8][1]} r={1.6} fill="#ededed" />
      </g>
    );
  };
  return (
    <Figure label="The rows, small: three movers with the strike and its distance from spot, the wall bar with today's part lit, the change, the day's line and the verdict chip; a folded line of steady strikes and the spot rule between" h={248}>
      {({ w }) => (
        <>
          <g fontFamily={FIG} fontSize={w} fill="#7c8290">
            <text x={COL.strike} y={14}>Strike</text>
            <text x={COL.bar} y={14}>The wall now</text>
            <text x={COL.change} y={14} textAnchor="end">Change</text>
            <text x={COL.day} y={14}>The day</text>
            <text x={COL.word} y={14}>What's happening</text>
          </g>
          <rect x={4} y={38 - 16} width={412} height={50} rx={3} fill={SILVER} fillOpacity={0.06} />
          {rows.map(r => (
            <g key={r.strike}>
              <text x={COL.strike} y={r.y} fontSize={w * 1.1} fontWeight={700} fill="#ededed" fontFamily={FIG}>
                {r.strike}
              </text>
              {r.tag && (
                <text x={COL.strike + 30} y={r.y} fontSize={w} fontWeight={700} fill={r.tag.ink} fontFamily={SANS}>
                  {r.tag.text}
                </text>
              )}
              <text x={COL.strike} y={r.y + 14} fontSize={w} fill="#7c8290" fontFamily={FIG}>
                {r.dist} spot
              </text>
              {/* the wall bar: the base, today's part lit or hatched */}
              <rect x={COL.bar} y={r.y - 7} width={COL.barW} height={7} rx={3.5} fill="#ffffff" fillOpacity={0.06} />
              <rect x={COL.bar} y={r.y - 7} width={r.base} height={7} rx={3.5} fill={SILVER} fillOpacity={0.32} />
              {r.gone ? (
                <rect x={COL.bar + r.base} y={r.y - 7} width={r.lit} height={7} fill="url(#build-hatch)" />
              ) : (
                <rect x={COL.bar + r.base} y={r.y - 7} width={r.lit} height={7} fill={BULL} />
              )}
              <text x={COL.bar} y={r.y + 14} fontSize={w} fontWeight={600} fill="#ededed" fontFamily={FIG}>
                {r.now}
                <tspan fill="#7c8290" fontWeight={400}>
                  {' '}
                  · was {r.was}
                </tspan>
              </text>
              <text x={COL.bar} y={r.y + 28} fontSize={w} fill="#7c8290" fontFamily={SANS}>
                {r.strike === '487' ? 'call-heavy · dealers push back on moves here' : 'put-heavy · dealers push moves along here'}
              </text>
              <text x={COL.change} y={r.y} fontSize={w} fontWeight={700} textAnchor="end" fill="#ededed" fontFamily={FIG}>
                {r.change}
              </text>
              {dayLine(r.day, r.y - 4)}
              <rect x={COL.word} y={r.y - 11} width={r.chip.length * w * 0.6 + 8} height={w + 4} rx={2} fill={r.tone} fillOpacity={0.12} stroke={r.tone} strokeOpacity={0.25} />
              <text x={COL.word + 4} y={r.y} fontSize={w} fontWeight={700} fill={r.tone} fontFamily={FIG}>
                {r.chip}
              </text>
              <text x={COL.change + 10} y={r.y + 14} fontSize={w} fill="#a3a3a3" fontFamily={SANS}>
                {r.words}
              </text>
            </g>
          ))}
          <defs>
            <pattern id="build-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2" height="5" fill={alpha(PUT_WALL, 0.6)} />
            </pattern>
          </defs>
          {/* a folded line of steady strikes */}
          <text x={COL.strike} y={88} fontSize={w} fill="#7c8290" fontFamily={FIG}>
            2 steady strikes between · 486 – 486
          </text>
          <line x1={240} x2={380} y1={84} y2={84} stroke="#ffffff" strokeOpacity={0.08} />
          <text x={410} y={88} fontSize={w} textAnchor="end" fill="#a3a3a3" fontFamily={FIG}>
            show
          </text>
          {/* the spot rule */}
          <line x1={10} x2={318} y1={106} y2={106} stroke="#ededed" strokeOpacity={0.35} />
          <text x={326} y={110} fontSize={w} fill="#a3a3a3" fontFamily={FIG}>
            SPY
          </text>
          <rect x={358} y={99} width={52} height={w + 3} rx={2} fill="#ededed" />
          <text x={384} y={110} fontSize={w} fontWeight={700} textAnchor="middle" fill="#0a0a0a" fontFamily={FIG}>
            486.40
          </text>
          <text x={210} y={228} fontSize={w} textAnchor="middle" fill="#7c8290" fontFamily={SANS}>
            hover a row for its words · click it to keep it
          </text>
          <text x={210} y={242} fontSize={w} textAnchor="middle" fill="#7c8290" fontFamily={SANS}>
            show opens a fold
          </text>
        </>
      )}
    </Figure>
  );
};

/* THE BAR, LARGE: one bar for the wall, a built one and a drained one */
const BarFigure = () => {
  const x0 = 14;
  const W = 392;
  return (
    <Figure label="The wall bar, large: the hedging sitting there now against the biggest wall shown; on a built wall the part that arrived today is green past the open's size, on a drained one the part that left is red hatching past the bar's end; the figure names now and the open" h={110}>
      {({ w }) => (
        <>
          <defs>
            <pattern id="build-hatch-big" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2.5" height="6" fill={alpha(PUT_WALL, 0.6)} />
            </pattern>
          </defs>
          <text x={x0} y={14} fontSize={w} fill="#7c8290" fontFamily={SANS}>
            a wall that was built today
          </text>
          <text x={x0 + W} y={14} fontSize={w} textAnchor="end" fontWeight={700} fill="#ededed" fontFamily={FIG}>
            $190M <tspan fill="#7c8290" fontWeight={400} fontFamily={SANS}>net gamma</tspan> <tspan fill="#7c8290" fontWeight={400}>· was $124M</tspan>
          </text>
          <rect x={x0} y={22} width={W} height={12} rx={6} fill="#ffffff" fillOpacity={0.06} />
          <rect x={x0} y={22} width={196} height={12} rx={6} fill={SILVER} fillOpacity={0.32} />
          <rect x={x0 + 196} y={22} width={104} height={12} fill={BULL} />
          <text x={x0 + 98} y={48} fontSize={w} textAnchor="middle" fill="#8a909c" fontFamily={SANS}>
            there at the open, still there
          </text>
          <text x={x0 + 248} y={48} fontSize={w} textAnchor="middle" fill={BULL} fontFamily={SANS}>
            arrived today
          </text>
          <text x={x0} y={70} fontSize={w} fill="#7c8290" fontFamily={SANS}>
            a wall that drained today
          </text>
          <text x={x0 + W} y={70} fontSize={w} textAnchor="end" fontWeight={700} fill="#ededed" fontFamily={FIG}>
            $226M <tspan fill="#7c8290" fontWeight={400}>· was $301M</tspan>
          </text>
          <rect x={x0} y={78} width={W} height={12} rx={6} fill="#ffffff" fillOpacity={0.06} />
          <rect x={x0} y={78} width={235} height={12} rx={6} fill={SILVER} fillOpacity={0.32} />
          <rect x={x0 + 235} y={78} width={78} height={12} fill="url(#build-hatch-big)" />
          <text x={x0 + 117} y={104} fontSize={w} textAnchor="middle" fill="#8a909c" fontFamily={SANS}>
            still there
          </text>
          <text x={x0 + 274} y={104} fontSize={w} textAnchor="middle" fill={PUT_WALL} fontFamily={SANS}>
            left today
          </text>
        </>
      )}
    </Figure>
  );
};

/* THE DAY, LARGE: a row that moved, its climb and its drop tinted; a steady row under it */
const DayFigure = () => {
  const x0 = 36;
  const x1 = 396;
  const n = 32;
  const moved = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const wig = (((i * 7) % 5) - 2) * 0.9;
    const shape = t < 0.25 ? 40 : t < 0.5 ? 40 - ((t - 0.25) / 0.25) * 22 : t < 0.7 ? 18 + ((t - 0.5) / 0.2) * 9 : 27 - ((t - 0.7) / 0.3) * 11;
    return [x0 + t * (x1 - x0), shape + wig + 2] as const;
  });
  const pt = (p: readonly [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const steady = Array.from({ length: n + 1 }, (_, i) => [x0 + (i / n) * (x1 - x0), 78 + (((i * 5) % 3) - 1) * 0.8] as const);
  return (
    <Figure label="The day's line, large: the stretch with the biggest climb tinted green, the one with the biggest drop tinted red, the last point lit; a steady row under it as one quiet line" h={100}>
      {({ w }) => (
        <>
          <polyline points={moved.map(pt).join(' ')} fill="none" stroke="#8a909c" strokeWidth={1.1} strokeLinejoin="round" />
          <polyline points={moved.slice(8, 17).map(pt).join(' ')} fill="none" stroke={BULL} strokeOpacity={0.9} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={moved.slice(22, 33).map(pt).join(' ')} fill="none" stroke={PUT_WALL} strokeOpacity={0.9} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={moved[n][0]} cy={moved[n][1]} r={2.2} fill="#ededed" />
          <text x={moved[12][0]} y={12} fontSize={w} textAnchor="middle" fill={BULL} fontFamily={SANS}>
            the biggest climb, green
          </text>
          <text x={moved[27][0] - 20} y={60} fontSize={w} textAnchor="middle" fill={PUT_WALL} fontFamily={SANS}>
            the biggest drop, red
          </text>
          <text x={x0} y={60} fontSize={w} fill="#7c8290" fontFamily={FIG}>
            open
          </text>
          <text x={x1} y={12} fontSize={w} textAnchor="end" fill="#7c8290" fontFamily={FIG}>
            now
          </text>
          <polyline points={steady.map(pt).join(' ')} fill="none" stroke="#5c6270" strokeWidth={1} strokeLinejoin="round" />
          <circle cx={steady[n][0]} cy={steady[n][1]} r={1.8} fill="#8a909c" />
          <text x={x0} y={95} fontSize={w} fill="#7c8290" fontFamily={SANS}>
            a steady row is one quiet line, nothing marked
          </text>
        </>
      )}
    </Figure>
  );
};

/* THE FLOOR: what counts as building or draining, and what stays steady */
const FloorFigure = () => {
  const x0 = 70;
  const floor = x0 + 62;
  const rows = [
    { strike: '487', w: 160, word: 'building' },
    { strike: '485', w: 118, word: 'draining' },
    { strike: '486', w: 40, word: 'steady' },
    { strike: '488', w: 22, word: 'steady' },
    { strike: '484', w: 12, word: 'steady' },
  ];
  return (
    <Figure label="Five strikes' changes as bars against one dashed line at 5% of the biggest wall: the two past it are building or draining, the three short of it are steady" h={112}>
      {({ w }) => (
        <>
          <line x1={floor} x2={floor} y1={20} y2={108} stroke={SILVER} strokeOpacity={0.6} strokeDasharray="2 3" />
          <text x={floor + 4} y={13} fontSize={w} fill={SILVER} fontFamily={SANS}>
            5% of the biggest wall shown
          </text>
          {rows.map((r, i) => {
            const y = 32 + i * 17;
            const past = r.w > floor - x0;
            return (
              <g key={r.strike}>
                <text x={x0 - 8} y={y + 4} fontSize={w} textAnchor="end" fill="#ededed" fontFamily={FIG}>
                  {r.strike}
                </text>
                <rect x={x0} y={y - 3.5} width={r.w} height={7} rx={3.5} fill="#ffffff" fillOpacity={past ? 0.55 : 0.16} />
                {/* a word never crosses the line: past it, beside the bar; short of it, just past the line */}
                <text x={past ? x0 + r.w + 6 : floor + 8} y={y + 4} fontSize={w} fill={past ? 'rgb(var(--text-primary))' : 'rgb(var(--text-muted))'} fontFamily={SANS}>
                  {r.word}
                </text>
              </g>
            );
          })}
        </>
      )}
    </Figure>
  );
};

/* THE DRAWING ITSELF, SMALL (Noah, 2026-09-08: "i dont find anything on the
   building page that even remotely looks like 'the pace'… wouldn't this be
   considered misrepresentation?" — the old figure showed three bar groups
   from the box's table days; the box is a drawing now, so the guide draws
   the drawing): four rows on the strike axis, one per level in its ink,
   spot dotted through them; a hollow dot where it opened, a filled dot where
   it is now, a dashed ring with an arrow where today's pace puts it, a
   diamond for the strike growing fastest on that side, tied to the wall. */
const HeadingFigure = () => {
  const L = 84;
  const R = 408;
  const x = (t: number) => L + (R - L) * t;
  const rows: { name: string; ink: string; open?: number; now: number; close?: number; ch?: number }[] = [
    { name: 'Call wall', ink: CALL_WALL, open: 0.74, now: 0.7, close: 0.84, ch: 0.84 },
    { name: 'Supreme', ink: SUPREME, now: 0.7 },
    { name: 'Flip', ink: FLIP, open: 0.4, now: 0.5 },
    { name: 'Put wall', ink: PUT_WALL, now: 0.3, ch: 0.2 },
  ];
  const TOP = 22;
  const PITCH = 25;
  const H = TOP + rows.length * PITCH + 20;
  const spot = 0.55;
  return (
    <Figure label="Where the walls are heading, small: each level on the strike axis, a hollow dot where it opened, a filled dot for now, a dashed ring where today's pace puts it, a diamond for the strike growing fastest on that side" h={H}>
      {({ w, t }) => (
        <>
          {[0.05, 0.25, 0.45, 0.65, 0.85].map((v, i) => (
            <g key={i}>
              <line x1={x(v)} x2={x(v)} y1={TOP - 8} y2={H - 18} stroke="#ffffff" strokeOpacity={0.05} />
              <text x={x(v)} y={H - 5} textAnchor="middle" fontSize={t} fill="#7c8290" fontFamily={FIG}>
                {480 + i * 4}
              </text>
            </g>
          ))}
          <line x1={x(spot)} x2={x(spot)} y1={TOP - 4} y2={H - 18} stroke="#ededed" strokeOpacity={0.5} strokeDasharray="1 3" />
          <text x={x(spot)} y={TOP - 8} textAnchor="middle" fontSize={w} fontWeight={600} fill="#ededed" fontFamily={FIG}>
            490.10
          </text>
          {rows.map((r, i) => {
            const y = TOP + i * PITCH + PITCH / 2;
            const moves = r.close != null && r.close !== r.now;
            return (
              <g key={r.name}>
                <line x1={L} x2={R} y1={y} y2={y} stroke="#ffffff" strokeOpacity={0.055} />
                <text x={L - 10} y={y + 4} textAnchor="end" fontSize={w} fontWeight={600} fill={r.ink} fontFamily={SANS}>
                  {r.name}
                </text>
                {r.ch != null && r.ch !== r.close && (
                  <>
                    <line x1={x(r.ch)} x2={x(r.now)} y1={y} y2={y} stroke={r.ink} strokeOpacity={0.3} strokeDasharray="2 3" />
                    <rect x={x(r.ch) - 2.6} y={y - 2.6} width={5.2} height={5.2} transform={`rotate(45 ${x(r.ch)} ${y})`} fill="#0a0a0a" stroke={r.ink} strokeOpacity={0.75} strokeWidth={1} />
                  </>
                )}
                {r.open != null && r.open !== r.now && <line x1={x(r.open)} x2={x(r.now)} y1={y} y2={y} stroke={r.ink} strokeOpacity={0.35} strokeWidth={1} />}
                {moves && (
                  <>
                    <line x1={x(r.now)} x2={x(r.close!) - 10} y1={y} y2={y} stroke={r.ink} strokeOpacity={0.75} strokeWidth={1} strokeDasharray="3 3" />
                    <path d={`M${x(r.close!) - 10},${y - 3} L${x(r.close!) - 5.5},${y} L${x(r.close!) - 10},${y + 3} Z`} fill={r.ink} fillOpacity={0.8} />
                    <circle cx={x(r.close!)} cy={y} r={3.2} fill="#0a0a0a" stroke={r.ink} strokeOpacity={0.8} strokeWidth={1} strokeDasharray="1.8 1.8" />
                  </>
                )}
                {r.open != null && r.open !== r.now && <circle cx={x(r.open)} cy={y} r={2.4} fill="none" stroke={r.ink} strokeOpacity={0.65} strokeWidth={1} />}
                <circle cx={x(r.now)} cy={y} r={3.8} fill={r.ink} />
              </g>
            );
          })}
        </>
      )}
    </Figure>
  );
};

/** Box 2's guide: the drawing, drawn small, and the levels in words */
export const HeadingGuide = ({ data, clock }: { data: Building; clock: AheadClock }) => (
  <div data-heading-guide>
    <Section title="The four levels, moving">
      <p>
        One row per level on the strike axis. A hollow dot is where it stood at the open, the filled dot is where it is now, the dashed ring is where {clock.inSession ? "today's pace" : "the last session's pace"} puts it {clock.inSession ? 'by the close' : 'next session'}. A wall that holds shows one dot. The diamond is the strike growing fastest on that side, tied to the wall by how far short it is.
      </p>
      <HeadingFigure />
    </Section>
    <Section title="The pace">
      <p>Today's change over the minutes run, continued to the close in a straight line. Not a forecast: it shows a wall forming before it is the wall, and the same line is behind "at today's pace" in the ledger's read line above.</p>
    </Section>
    <Section title="Today">
      {data.heading.map(l => (
        <p key={l.name} className="mt-1 first:mt-0">
          <span className="text-textPrimary">{l.name}</span> · {l.words}
        </p>
      ))}
    </Section>
  </div>
);

export const BuildingGuide = ({ data, clock }: { data: Building; clock: AheadClock }) => (
  <div data-build-guide>
    <Section title="The row">
      <p>One row per strike that moved. The strike carries its role and how far it sits from spot. The bar is the hedging there now, with today's part lit. Then the change in dollars, the calls and puts behind it, the day's line, and the verdict as a chip: building, draining, changed sides, new today. The steady strikes fold into one line each — show opens them, and Show · Every strike opens them all. Hover a row for its full read; click it to keep it.</p>
      <LedgerFigure />
    </Section>
    <Section title="The bar">
      <p>One bar, as long as the hedging sitting at the strike against the biggest wall shown. The quiet part was there at the open and still is. On a wall that was built today the green part arrived today. On one that drained, the red hatching past the end is what left. The figure is the wall now in dollars of dealer hedging — the stock dealers must trade for a 1% move because of the options open there — and "was" is what the same contracts were worth at the open.</p>
      <BarFigure />
    </Section>
    <Section title="The day">
      <p>The wall's size through the session. On a row that moved, the stretch with the biggest climb is tinted green and the one with the biggest drop red. A steady row is one quiet line.</p>
      <DayFigure />
    </Section>
    <Section title="Where the number comes from">
      <p>Open interest is published overnight, so through the day it is our estimate from today's trades. A change counts as building or draining only past 5% of the biggest wall shown; under that it is steady.</p>
      <FloorFigure />
    </Section>
    <Section title="Today">
      <p>{data.sentence}</p>
      <p className="mt-1 text-textMuted">
        Built {fmtDollars(data.built)} · drained {fmtDollars(data.drained)}
        {data.fastestUp ? ` · growing fastest ${fmtStrike(data.fastestUp.strike)}` : ''}
        {data.fastestDown ? ` · fading fastest ${fmtStrike(data.fastestDown.strike)}` : ''}
        {clock.inSession ? ` · ${data.minutesLeft} minutes left` : ' · the last session'}
      </p>
    </Section>
  </div>
);
