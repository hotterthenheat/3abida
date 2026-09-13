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

import type { Compare } from '../../data/compare';
import { Name } from '../ui/Name';

const INK = 'rgb(var(--text-primary))';
const INK_2 = 'rgb(var(--text-secondary))';
const INK_3 = 'rgb(var(--text-muted))';
const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const GRID = 'rgba(255,255,255,0.07)';
const COOL_1 = '#ABD9E9';
const COOL_2 = '#74ADD1';
const COOL_3 = '#4575B4';
const WARM_1 = '#FDAE61';
const WARM_2 = '#F46D43';
const WARM_3 = '#D73027';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const Capsule = ({ x, y, w, fill, text, ink = '#0a0a0a', align = 'end' }: { x: number; y: number; w: number; fill: string; text?: string; ink?: string; align?: 'start' | 'end' }) => (
  <g>
    <rect x={x} y={y - 7} width={w} height={14} rx={7} fill={fill} />
    {text && (
      <text x={align === 'end' ? x + w - 6 : x + 6} y={y + 0.5} textAnchor={align} dominantBaseline="middle" fontFamily={MONO} fontSize="9" fontWeight="600" fill={ink}>
        {text}
      </text>
    )}
  </g>
);
const Label = ({ x, y, children, anchor = 'start', fill = INK_2, size = 9.5, mono = false }: { x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end'; fill?: string; size?: number; mono?: boolean }) => (
  <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={mono ? MONO : SANS} fontSize={size} fill={fill}>
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
    <svg viewBox="0 0 368 172" width="100%" role="img" aria-label="Two names side by side on one column of distances from spot; the first name's capsules grow left, the second's grow right" data-guide-figure="ruler">
      <rect x={cx - col / 2} y={8} width={col} height={140} fill="rgba(255,255,255,0.03)" />
      {ticks.map(t => (
        <g key={t.t}>
          <line x1={10} x2={cx - col / 2 - 2} y1={t.y + 0.5} y2={t.y + 0.5} stroke={GRID} />
          <line x1={cx + col / 2 + 2} x2={358} y1={t.y + 0.5} y2={t.y + 0.5} stroke={GRID} />
          {t.t === 'spot' ? (
            <>
              <rect x={cx - 22} y={t.y - 8} width={44} height={16} rx={4} fill={INK} />
              <Label x={cx} y={t.y} anchor="middle" fill="#0a0a0a" size={9} mono>
                spot
              </Label>
            </>
          ) : (
            <Label x={cx} y={t.y} anchor="middle" size={9} mono>
              {t.t}
            </Label>
          )}
        </g>
      ))}
      {/* the first name, growing left */}
      <Capsule x={cx - col / 2 - 4 - 118} y={36} w={118} fill={COOL_3} text="$256M" ink="#ffffff" align="start" />
      <Capsule x={cx - col / 2 - 4 - 62} y={58} w={62} fill={COOL_2} text="$110M" align="start" />
      <Capsule x={cx - col / 2 - 4 - 84} y={98} w={84} fill={WARM_2} text="$131M" align="start" />
      <Capsule x={cx - col / 2 - 4 - 40} y={120} w={40} fill={WARM_1} />
      <rect x={4} y={28} width={44} height={16} rx={8} fill="rgba(48,209,88,0.14)" stroke="rgba(48,209,88,0.5)" />
      <Label x={26} y={36} anchor="middle" fill="#30D158" size={8.5}>
        Call wall
      </Label>
      {/* the second name, growing right */}
      <Capsule x={cx + col / 2 + 4} y={30} w={44} fill={COOL_1} />
      <Capsule x={cx + col / 2 + 4} y={64} w={96} fill={COOL_2} text="$88M" />
      <Capsule x={cx + col / 2 + 4} y={92} w={70} fill={WARM_1} text="$61M" />
      <Capsule x={cx + col / 2 + 4} y={126} w={124} fill={WARM_3} text="$202M" ink="#ffffff" />
      <rect x={cx + col / 2 + 4 + 124 + 8} y={118} width={44} height={16} rx={8} fill="rgba(255,59,48,0.14)" stroke="rgba(255,59,48,0.5)" />
      <Label x={cx + col / 2 + 4 + 124 + 30} y={126} anchor="middle" fill="#FF3B30" size={8.5}>
        Put wall
      </Label>
      {/* the words */}
      <Label x={10} y={158} fill={INK} size={9.5}>
        {a}
      </Label>
      <Label x={40} y={158} fill={INK_3}>
        grows left · each capsule at its distance from its own spot
      </Label>
      <Label x={358} y={158} anchor="end" fill={INK} size={9.5}>
        {b}
      </Label>
      <circle cx={cx} cy={8} r={0} fill={SILVER} />
    </svg>
  );
};

const CompareGuide = ({ cmp }: { cmp: Compare }) => {
  const { a, b } = cmp;
  return (
    <div className="px-3 py-3 flex flex-col gap-3" data-compare-guide-card>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">Head to head · the same ten reads for two names</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          <Name t={a.ticker} size={11} /> down the left, <Name t={b.ticker} size={11} /> down the right, one read per row. The middle names the read and says what the two say against each other: whose wall is nearer, whose expected move is wider, who sheds more at the close. Click a strike to keep it.
        </p>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">The two books on one ruler · why not a price axis</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          Two names cannot share a price axis, so they share a ruler: how far each strike is from its own name's spot. <Name t={a.ticker} size={11} />'s capsules grow left from the column, <Name t={b.ticker} size={11} />'s grow right, each at the height its distance puts it, so a wall 0.6% overhead sits at the same height on both sides whatever the two prices are. Each side is scaled to its own heaviest strike on the ruler, so the shape of the two books is the read and the figure inside a capsule carries the size. The Reach card sets how far the ruler runs, in the day's expected moves; the Greek card switches the ruler, the four rows under it and the Supreme row on the card between gamma, delta, vega, vanna and charm — the walls stay gamma's, because a wall is a gamma idea. The four rows add up what sits in each band of reach for both names and say who is heavier and which way each leans. The Greek card's All lays the five greeks out side by side as five lanes on the same ruler, sharing one window, so a scroll on any of them moves them all; the door at the title gives the ruler the whole screen.
        </p>
        <div className="mt-2 rounded-md border border-borderSubtle/60 bg-panel px-2 py-2">
          <RulerFigure a={a.ticker} b={b.ticker} />
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">Since the open · today, the same line for both</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          <Name t={a.ticker} size={11} /> and <Name t={b.ticker} size={11} /> each as percent from their own open, one line each and nothing else on the plot. The bars beneath are the gap between them, minute by minute, in the leader's ink, so who is ahead and by how much reads at a glance.
        </p>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">The pair · is today's gap usual</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          <Name t={a.ticker} size={11} />'s close over <Name t={b.ticker} size={11} />'s, session by session: higher means <Name t={a.ticker} size={11} /> ahead, lower means <Name t={b.ticker} size={11} /> ahead. The shaded band is the usual range, one standard deviation each way of the average; the sessions that closed outside it are marked. Today's point is lit. Inside the band, today's gap is ordinary; outside it, one name has run further ahead than it usually does.
        </p>
      </div>
      <p className="text-[10px] text-textMuted">The ruler at the top of the page changes the distances everywhere on this page.</p>
    </div>
  );
};

export default CompareGuide;
