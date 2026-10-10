/*
==================================================
  SLAYER TERMINAL - HOW TO READ COMPARE
  (components/gex/CompareGuide.tsx)

  The card behind the Compare page's "How to read"
  door: the ruler drawn in the box's own hand — two
  names on one column of distances — and a sentence
  or two for each of the three boxes, with today's
  two names in the words.
==================================================
*/

import Glossary from '../levels/Glossary';
import type { Compare } from '../../data/compare';
import { FONT_SANS } from '../../theme/fonts';
import { GuideSvg } from '../ui/GuideSvg';

const INK = 'rgb(var(--text-primary))';
const INK_2 = 'rgb(var(--text-secondary))';
const INK_3 = 'rgb(var(--text-muted))';
const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const GRID = 'rgb(var(--ink) / 0.07)';
const COOL_1 = '#ABD9E9';
const COOL_2 = '#74ADD1';
const COOL_3 = '#4575B4';
const WARM_1 = '#FDAE61';
const WARM_2 = '#F46D43';
const WARM_3 = '#D73027';
/* the figures' voice — Helvetica's digits are tabular (theme/fonts.ts) */
const FIG = FONT_SANS;
const SANS = FONT_SANS;

const Capsule = ({ x, y, w, fill, text, ink = '#0a0a0a', align = 'end', s }: { x: number; y: number; w: number; fill: string; text?: string; ink?: string; align?: 'start' | 'end'; s: number }) => (
  <g>
    <rect x={x} y={y - 7} width={w} height={14} rx={7} fill={fill} />
    {text && (
      <text x={align === 'end' ? x + w - 6 : x + 6} y={y + 0.5} textAnchor={align} dominantBaseline="middle" fontFamily={FIG} fontSize={s} fontWeight="600" fill={ink}>
        {text}
      </text>
    )}
  </g>
);
const Label = ({ x, y, children, anchor = 'start', fill = INK_2, size, mono = false }: { x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end'; fill?: string; size: number; mono?: boolean }) => (
  <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={mono ? FIG : SANS} fontSize={size} fill={fill}>
    {children}
  </text>
);

/** THE FIGURE — two names on one column of distances; the first grows left, the second right */
const RulerFigure = ({ a, b }: { a: string; b: string }) => {
  const cx = 184;
  const col = 60;
  const ticks = [
    { y: 22, t: '+1.0%' },
    { y: 50, t: '+0.5%' },
    { y: 78, t: 'spot' },
    { y: 106, t: '−0.5%' },
    { y: 134, t: '−1.0%' },
  ];
  return (
    <GuideSvg w={368} h={180} word={9.75} label="Two names side by side on one column of distances from spot; the first name's capsules grow left, the second's grow right" figure="ruler">
      {({ w, t }) => (
        <>
          <rect x={cx - col / 2} y={8} width={col} height={140} fill="rgb(var(--ink) / 0.03)" />
          {ticks.map(k => (
            <g key={k.t}>
              <line x1={10} x2={cx - col / 2 - 2} y1={k.y + 0.5} y2={k.y + 0.5} stroke={GRID} />
              <line x1={cx + col / 2 + 2} x2={358} y1={k.y + 0.5} y2={k.y + 0.5} stroke={GRID} />
              {k.t === 'spot' ? (
                <>
                  <rect x={cx - 22} y={k.y - 8} width={44} height={16} rx={4} fill={INK} />
                  <Label x={cx} y={k.y} anchor="middle" fill="rgb(var(--panel))" size={w} mono>
                    spot
                  </Label>
                </>
              ) : (
                <Label x={cx} y={k.y} anchor="middle" size={t} mono>
                  {k.t}
                </Label>
              )}
            </g>
          ))}
          {/* the first name, growing left — its longest capsule stops short of the wall's tag (at 118 the two overlapped) */}
          <Capsule s={w} x={cx - col / 2 - 4 - 88} y={36} w={88} fill={COOL_3} text="$256M" ink="#ffffff" align="start" />
          <Capsule s={w} x={cx - col / 2 - 4 - 50} y={58} w={50} fill={COOL_2} text="$110M" align="start" />
          <Capsule s={w} x={cx - col / 2 - 4 - 68} y={98} w={68} fill={WARM_2} text="$131M" align="start" />
          <Capsule s={w} x={cx - col / 2 - 4 - 33} y={120} w={33} fill={WARM_1} />
          {/* the walls' tags hold their 11 px words (2026-10-10): wider tags, the capsules beside them a little shorter */}
          <rect x={2} y={28} width={56} height={16} rx={8} fill="rgb(var(--bull) / 0.14)" stroke="rgb(var(--bull) / 0.5)" />
          <Label x={30} y={36} anchor="middle" fill="rgb(var(--bull))" size={w}>
            Call wall
          </Label>
          {/* the second name, growing right — its wall's tag inside the figure (at 124 the tag ran off the right edge) */}
          <Capsule s={w} x={cx + col / 2 + 4} y={30} w={33} fill={COOL_1} />
          <Capsule s={w} x={cx + col / 2 + 4} y={64} w={73} fill={COOL_2} text="$88M" />
          <Capsule s={w} x={cx + col / 2 + 4} y={92} w={53} fill={WARM_1} text="$61M" />
          <Capsule s={w} x={cx + col / 2 + 4} y={126} w={84} fill={WARM_3} text="$202M" ink="#ffffff" />
          <rect x={cx + col / 2 + 4 + 84 + 4} y={118} width={56} height={16} rx={8} fill="rgb(var(--bear) / 0.14)" stroke="rgb(var(--bear) / 0.5)" />
          <Label x={cx + col / 2 + 4 + 84 + 32} y={126} anchor="middle" fill="rgb(var(--bear))" size={w}>
            Put wall
          </Label>
          {/* the words */}
          <text x={10} y={160} dominantBaseline="middle" fontFamily={SANS} fontSize={w} fill={INK}>
            {a} <tspan fill={INK_3}>grows left</tspan>
          </text>
          <Label x={358} y={160} anchor="end" fill={INK} size={w}>
            {b}
          </Label>
          <Label x={10} y={174} fill={INK_3} size={w}>
            each capsule at its distance from its own spot
          </Label>
          <circle cx={cx} cy={8} r={0} fill={SILVER} />
        </>
      )}
    </GuideSvg>
  );
};

const CompareGuide = ({ cmp }: { cmp: Compare }) => {
  const { a, b } = cmp;
  return (
    <div className="px-3 py-3 flex flex-col gap-3" data-compare-guide-card>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">Head to head · the same ten reads for two names</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          One table: the read down the left in three groups — today, the levels, the close — then {a.ticker} and {b.ticker} side by side under their own chips, so the two figures touch. The bold figure is the side that leads that read; the last column says what the two say against each other: whose wall is nearer, whose expected move is wider, who sheds more at the close. Click a strike to keep it.
        </p>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">The two books on one ruler · why not a price axis</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          Two names cannot share a price axis, so they share a ruler: how far each strike is from its own name's spot. {a.ticker}'s capsules grow left from the column, {b.ticker}'s grow right, each at the height its distance puts it, so a wall 0.6% overhead sits at the same height on both sides whatever the two prices are. Each side is scaled to its own heaviest strike on the ruler, so the shape of the two books is the read and the figure inside a capsule carries the size. The strike figures run down each side of the ruler, so every capsule is named; a strike too light for a capsule is a short tick at the spine — a strike is there, nothing much on it — and the lane heads count them. The Reach card sets how far the ruler runs, in the day's expected moves; the Greek card switches the ruler and the Supreme row on the card between gamma, delta, vega, vanna and charm — the walls stay gamma's, because a wall is a gamma idea. Tick more than one greek and each gets a lane on the same ruler, sharing one window, so a scroll on any of them moves them all; the door at the head's far right gives the ruler the whole screen.
        </p>
        <div className="mt-2 rounded-md border border-borderSubtle/60 bg-panel px-2 py-2">
          <RulerFigure a={a.ticker} b={b.ticker} />
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">Since the open · today, the same line for both</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          {a.ticker} and {b.ticker} each as percent from their own open, one line each and nothing else on the plot. The band beneath is the gap between them, minute by minute, filled in the leader's ink, so who is ahead and by how much reads at a glance.
        </p>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">The pair · which one has been stronger</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          {a.ticker}'s price divided by {b.ticker}'s, one point a day. When the line rises, {a.ticker} is gaining on {b.ticker}; when it falls, {b.ticker} is gaining. The shaded band is the usual range, where it closed on about two days in three, with its average dashed through it; the names sit inside the plot at the left, the figures on the axis. A day that closed outside the range wears a warm mark on the line, and today a silver one. Inside the range, today's gap between the two is ordinary; outside it, one name has run further ahead of the other than it usually does. Hover any day for the two prices and where that day sat.
        </p>
      </div>
      <p className="text-[11px] text-textMuted">The ruler at the top of the page changes the distances everywhere on this page.</p>
      <Glossary words={['wall', 'flip', 'supreme', 'ruler', 'sign']} />
    </div>
  );
};

export default CompareGuide;
