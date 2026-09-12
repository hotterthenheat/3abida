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
import { BULL, CALL_WALL, FLIP, PUT_WALL, SUPREME } from './paletteInk';
import { fmtDollars, fmtStrike, type AheadClock } from '../../data/ahead';
import type { Building } from '../../data/building';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const MONO = 'ui-monospace, Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';
/** The two lane inks — the same ramp the capsules wear */
export interface LaneInks {
  pos: string;
  neg: string;
}

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

/* THE LEDGER, DRAWN SMALL (Noah, 2026-09-08: "the what's being built how to
   read can use some better refinement of images"): four rows the way the
   ledger draws them — strike and its tag, the capsule in its ink with the
   figure inside, the two-lane bar on its centre line, the change, the day's
   line, the word — the spot rule between, and one row washed the way a
   hovered row is. Every column is one the reader can find behind the card. */
const LedgerFigure = ({ inks }: { inks: LaneInks }) => {
  const COL = { strike: 10, tag: 36, cap: 70, capW: 72, bar: 150, barW: 84, change: 282, day: 290, dayW: 46, word: 344 };
  const cx = COL.bar + COL.barW / 2;
  type Row = { y: number; strike: string; tag?: { text: string; ink: string }; ink: string; alpha: number; now: string; calls: number; puts: number; change: string; loud: boolean; word: string; day: 'flat' | 'up' | 'down'; washed?: boolean };
  const rows: Row[] = [
    { y: 34, strike: '488', ink: inks.neg, alpha: 0.55, now: '$61M', calls: 14, puts: 6, change: '+$4M', loud: false, word: 'steady', day: 'flat' },
    { y: 58, strike: '487', tag: { text: 'CALL WALL', ink: CALL_WALL }, ink: inks.neg, alpha: 0.95, now: '$190M', calls: 40, puts: -10, change: '+$25M', loud: true, word: 'building · calls', day: 'up', washed: true },
    { y: 96, strike: '485', tag: { text: 'PUT WALL', ink: PUT_WALL }, ink: inks.pos, alpha: 0.95, now: '$226M', calls: 8, puts: -34, change: '−$18M', loud: true, word: 'draining · puts', day: 'down' },
    { y: 120, strike: '484', ink: inks.pos, alpha: 0.5, now: '$40M', calls: 3, puts: -4, change: '−$1M', loud: false, word: 'steady', day: 'flat' },
  ];
  const dayLine = (kind: Row['day'], y: number) => {
    const x0 = COL.day;
    const pts = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      const wig = ((i * 7) % 3) - 1;
      const base = kind === 'up' ? 5 - t * 10 : kind === 'down' ? -5 + t * 10 : 0;
      return [x0 + t * COL.dayW, y + base + wig * 0.8] as const;
    });
    const path = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`);
    const tint = kind === 'up' ? BULL : kind === 'down' ? PUT_WALL : null;
    return (
      <g>
        <polyline points={path.join(' ')} fill="none" stroke={kind === 'flat' ? '#5c6270' : '#8a909c'} strokeWidth={1} strokeLinejoin="round" />
        {tint && <polyline points={path.slice(3, 7).join(' ')} fill="none" stroke={tint} strokeOpacity={0.85} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />}
        <circle cx={pts[8][0]} cy={pts[8][1]} r={1.6} fill="#ededed" />
      </g>
    );
  };
  return (
    <Figure label="The ledger, small: four strike rows with the capsule, the two-lane bar, the change, the day's line and the word, the spot rule between, one row washed as a hovered row is" h={150}>
      {/* the head */}
      <g fontFamily={MONO} fontSize={6} fill="#7c8290" letterSpacing={0.4}>
        <text x={COL.strike} y={14}>STRIKE</text>
        <text x={COL.cap} y={14}>HEDGING NOW</text>
        <text x={COL.bar} y={14}>ADDED TODAY</text>
        <text x={COL.change} y={14} textAnchor="end">CHANGE</text>
        <text x={COL.day} y={14}>THE DAY</text>
        <text x={COL.word} y={14}>WHAT'S HAPPENING</text>
      </g>
      {/* the hovered row's wash: one band across the row */}
      <rect x={4} y={58 - 10} width={412} height={20} rx={3} fill={SILVER} fillOpacity={0.06} />
      {rows.map(r => (
        <g key={r.strike}>
          <text x={COL.strike} y={r.y + 3.5} fontSize={9.5} fontWeight={700} fill="#ededed" fontFamily={MONO}>
            {r.strike}
          </text>
          {r.tag && (
            <text x={COL.tag} y={r.y + 3} fontSize={5.5} fill={r.tag.ink} fontFamily={MONO} letterSpacing={0.8}>
              {r.tag.text}
            </text>
          )}
          {/* the capsule — colour is the value */}
          <rect x={COL.cap} y={r.y - 7} width={COL.capW} height={14} rx={7} fill={r.ink} fillOpacity={r.alpha} />
          <text x={COL.cap + COL.capW - 6} y={r.y + 3} fontSize={7.5} fontWeight={600} textAnchor="end" fill={r.alpha > 0.7 ? '#0a0a0a' : 'rgb(var(--text-primary))'} fontFamily={MONO}>
            {r.now}
          </text>
          {/* the two-lane bar */}
          <line x1={cx} x2={cx} y1={r.y - 8} y2={r.y + 8} stroke="#ffffff" strokeOpacity={0.2} />
          <rect x={r.calls >= 0 ? cx : cx + r.calls} y={r.y - 6} width={Math.abs(r.calls)} height={4.5} rx={2.25} fill={inks.neg} fillOpacity={r.calls >= 0 ? 0.92 : 0.5} />
          <rect x={r.puts >= 0 ? cx : cx + r.puts} y={r.y + 1.5} width={Math.abs(r.puts)} height={4.5} rx={2.25} fill={inks.pos} fillOpacity={r.puts >= 0 ? 0.92 : 0.5} />
          {/* the change */}
          <text x={COL.change} y={r.y + 3} fontSize={8} fontWeight={r.loud ? 700 : 400} textAnchor="end" fill={r.loud ? 'rgb(var(--text-primary))' : 'rgb(var(--text-muted))'} fontFamily={MONO}>
            {r.change}
          </text>
          {dayLine(r.day, r.y)}
          <text x={COL.word} y={r.y + 3} fontSize={7} fill={r.word === 'steady' ? 'rgb(var(--text-muted))' : r.word.startsWith('draining') ? 'rgb(var(--text-secondary))' : 'rgb(var(--text-primary))'} fontFamily={SANS}>
            {r.word}
          </text>
        </g>
      ))}
      {/* the spot rule */}
      <line x1={10} x2={338} y1={77} y2={77} stroke="#ededed" strokeOpacity={0.35} />
      <text x={346} y={79.5} fontSize={6.5} fill="#a3a3a3" fontFamily={MONO} letterSpacing={0.6}>
        SPY
      </text>
      <rect x={378} y={72} width={34} height={10} rx={2} fill="#ededed" />
      <text x={395} y={79.5} fontSize={7} fontWeight={700} textAnchor="middle" fill="#0a0a0a" fontFamily={MONO}>
        486.40
      </text>
      <text x={210} y={143} fontSize={7} textAnchor="middle" fill="#7c8290" fontFamily={SANS}>
        hover a row for its words · click it to keep it
      </text>
    </Figure>
  );
};

/* THE BAR, LARGE: two lanes off one centre line, a worked example */
const BarFigure = ({ inks }: { inks: LaneInks }) => {
  const cx = 200;
  const y = 44;
  return (
    <Figure label="The two-lane bar, large: calls above in the cool ink, puts below in the warm one; right of the centre line was added today, left was taken off; the figure is how much the wall grew" h={92}>
      <text x={cx - 6} y={16} fontSize={7.5} textAnchor="end" fill="#7c8290" fontFamily={SANS}>
        taken off ◂
      </text>
      <text x={cx + 6} y={16} fontSize={7.5} fill="#7c8290" fontFamily={SANS}>
        ▸ added
      </text>
      <line x1={cx} x2={cx} y1={22} y2={68} stroke="#ffffff" strokeOpacity={0.25} />
      {/* calls lane */}
      <rect x={cx} y={y - 16} width={124} height={10} rx={5} fill={inks.neg} fillOpacity={0.92} />
      <text x={cx + 4} y={y - 20} fontSize={7.5} fontWeight={600} fill={inks.neg} fontFamily={MONO}>
        calls · +$22M added
      </text>
      {/* puts lane */}
      <rect x={cx - 34} y={y + 6} width={34} height={10} rx={5} fill={inks.pos} fillOpacity={0.5} />
      <text x={cx - 4} y={y + 27} fontSize={7.5} fontWeight={600} textAnchor="end" fill={inks.pos} fontFamily={MONO}>
        puts · −$3M taken off
      </text>
      {/* the figure the row prints */}
      <text x={cx + 136} y={y - 8} fontSize={10} fontWeight={700} fill="#ededed" fontFamily={MONO}>
        +$19M
      </text>
      <text x={cx + 136} y={y + 4} fontSize={7} fill="#7c8290" fontFamily={SANS}>
        the wall grew
      </text>
      <text x={cx + 136} y={y + 14} fontSize={7} fill="#7c8290" fontFamily={SANS}>
        by this much
      </text>
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
    return [x0 + t * (x1 - x0), shape + wig] as const;
  });
  const pt = (p: readonly [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const steady = Array.from({ length: n + 1 }, (_, i) => [x0 + (i / n) * (x1 - x0), 76 + (((i * 5) % 3) - 1) * 0.8] as const);
  return (
    <Figure label="The day's line, large: the stretch with the biggest climb tinted green, the one with the biggest drop tinted red, the last point lit; a steady row under it as one quiet line" h={96}>
      <polyline points={moved.map(pt).join(' ')} fill="none" stroke="#8a909c" strokeWidth={1.1} strokeLinejoin="round" />
      <polyline points={moved.slice(8, 17).map(pt).join(' ')} fill="none" stroke={BULL} strokeOpacity={0.9} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={moved.slice(22, 33).map(pt).join(' ')} fill="none" stroke={PUT_WALL} strokeOpacity={0.9} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={moved[n][0]} cy={moved[n][1]} r={2.2} fill="#ededed" />
      <text x={moved[12][0]} y={12} fontSize={7.5} textAnchor="middle" fill={BULL} fontFamily={SANS}>
        the biggest climb, green
      </text>
      <text x={moved[27][0]} y={56} fontSize={7.5} textAnchor="middle" fill={PUT_WALL} fontFamily={SANS}>
        the biggest drop, red
      </text>
      <text x={x0} y={56} fontSize={7} fill="#7c8290" fontFamily={MONO}>
        open
      </text>
      <text x={x1} y={12} fontSize={7} textAnchor="end" fill="#7c8290" fontFamily={MONO}>
        now
      </text>
      <polyline points={steady.map(pt).join(' ')} fill="none" stroke="#5c6270" strokeWidth={1} strokeLinejoin="round" />
      <circle cx={steady[n][0]} cy={steady[n][1]} r={1.8} fill="#8a909c" />
      <text x={x0} y={90} fontSize={7} fill="#7c8290" fontFamily={SANS}>
        a steady row is one quiet line, nothing marked
      </text>
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
    <Figure label="Five strikes' changes as bars against one dashed line at 5% of the biggest wall: the two past it are building or draining, the three short of it are steady" h={104}>
      <line x1={floor} x2={floor} y1={10} y2={92} stroke={SILVER} strokeOpacity={0.6} strokeDasharray="2 3" />
      <text x={floor + 4} y={14} fontSize={7} fill={SILVER} fontFamily={SANS}>
        5% of the biggest wall shown
      </text>
      {rows.map((r, i) => {
        const y = 26 + i * 14;
        const past = r.w > floor - x0;
        return (
          <g key={r.strike}>
            <text x={x0 - 8} y={y + 3} fontSize={8} textAnchor="end" fill="#ededed" fontFamily={MONO}>
              {r.strike}
            </text>
            <rect x={x0} y={y - 3.5} width={r.w} height={7} rx={3.5} fill="#ffffff" fillOpacity={past ? 0.55 : 0.16} />
            {/* a word never crosses the line: past it, beside the bar; short of it, just past the line */}
            <text x={past ? x0 + r.w + 6 : floor + 8} y={y + 3} fontSize={7.5} fill={past ? 'rgb(var(--text-primary))' : 'rgb(var(--text-muted))'} fontFamily={SANS}>
              {r.word}
            </text>
          </g>
        );
      })}
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
  const L = 64;
  const R = 408;
  const x = (t: number) => L + (R - L) * t;
  const rows: { name: string; ink: string; open?: number; now: number; close?: number; ch?: number }[] = [
    { name: 'Call wall', ink: CALL_WALL, open: 0.74, now: 0.7, close: 0.84, ch: 0.84 },
    { name: 'Supreme', ink: SUPREME, now: 0.7 },
    { name: 'Flip', ink: FLIP, open: 0.4, now: 0.5 },
    { name: 'Put wall', ink: PUT_WALL, now: 0.3, ch: 0.2 },
  ];
  const TOP = 18;
  const PITCH = 25;
  const H = TOP + rows.length * PITCH + 18;
  const spot = 0.55;
  return (
    <Figure label="Where the walls are heading, small: each level on the strike axis, a hollow dot where it opened, a filled dot for now, a dashed ring where today's pace puts it, a diamond for the strike growing fastest on that side" h={H}>
      {[0.05, 0.25, 0.45, 0.65, 0.85].map((t, i) => (
        <g key={i}>
          <line x1={x(t)} x2={x(t)} y1={TOP - 8} y2={H - 16} stroke="#ffffff" strokeOpacity={0.05} />
          <text x={x(t)} y={H - 5} textAnchor="middle" fontSize={7.5} fill="#7c8290" fontFamily={MONO}>
            {480 + i * 4}
          </text>
        </g>
      ))}
      <line x1={x(spot)} x2={x(spot)} y1={TOP - 4} y2={H - 16} stroke="#ededed" strokeOpacity={0.5} strokeDasharray="1 3" />
      <text x={x(spot)} y={TOP - 7} textAnchor="middle" fontSize={7.5} fontWeight={600} fill="#ededed" fontFamily={MONO}>
        490.10
      </text>
      {rows.map((r, i) => {
        const y = TOP + i * PITCH + PITCH / 2;
        const moves = r.close != null && r.close !== r.now;
        return (
          <g key={r.name}>
            <line x1={L} x2={R} y1={y} y2={y} stroke="#ffffff" strokeOpacity={0.055} />
            <text x={L - 10} y={y + 3} textAnchor="end" fontSize={8} fontWeight={600} fill={r.ink} fontFamily={SANS}>
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

export const BuildingGuide = ({ data, clock, inks }: { data: Building; clock: AheadClock; inks: LaneInks }) => (
  <div data-build-guide>
    <Section title="The row">
      <p>One row per strike. The capsule is the hedging there now and its colour is the value: cool holds price, warm pushes it along. The bar is what today added, the line is the day, the word is the verdict. Hover a row for its full read; click it to keep it.</p>
      <LedgerFigure inks={inks} />
    </Section>
    <Section title="The bar">
      <p>Two lanes off one centre line, calls above in the cool ink and puts below in the warm one. Right of the line was added today, left was taken off. The figure beside the bar is how much bigger or smaller the wall got.</p>
      <BarFigure inks={inks} />
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

export default BuildingGuide;
