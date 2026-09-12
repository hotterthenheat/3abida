/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE PROFILE PANEL
  (components/gex/ProfileGuide.tsx)

  The card behind the panel's "How to read" door
  (Noah, 2026-09-06: "how can someone know this
  info in the page?" then "the how to read should
  have some visuals. high quality visuals not just
  renders"). Two figures drawn in the panel's own
  hand — thermal capsules, a strike column, the
  spot chip — so the picture teaches the lane it
  sits next to:

    SIZE   one strike, one capsule; its length is
           the hedging parked there, its colour
           which way that hedging leans.
    FLOW   a trip from spot to a strike; every
           strike crossed adds its weight, and the
           running total is the bill on arrival.

  Under them, today's walls read both ways, from
  the live numbers.
==================================================
*/

import { fmtUsd } from '../../data/gex';
import { fmtFlow, type FlowLadder } from '../../data/hedgeFlow';
import type { GexLevel } from '../../types/market';
import type { PanelLevels } from './ProfilePanel';

const INK = 'rgb(var(--text-primary))';
const INK_2 = 'rgb(var(--text-secondary))';
const INK_3 = 'rgb(var(--text-muted))';
const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const GRID = 'rgba(255,255,255,0.07)';
/* The thermal ramp's stops, as the calendar and the panel paint them */
const COOL_1 = '#ABD9E9';
const COOL_2 = '#74ADD1';
const COOL_3 = '#4575B4';
const WARM_1 = '#FDAE61';
const WARM_2 = '#F46D43';
const WARM_3 = '#D73027';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** A capsule with its figure inside, the panel's own drawing */
const Capsule = ({ x, y, w, fill, text, ink = '#0a0a0a', h = 14 }: { x: number; y: number; w: number; fill: string; text?: string; ink?: string; h?: number }) => (
  <g>
    <rect x={x} y={y - h / 2} width={w} height={h} rx={h / 2} fill={fill} />
    {text && (
      <text x={x + w - 6} y={y + 0.5} textAnchor="end" dominantBaseline="middle" fontFamily={MONO} fontSize="9" fontWeight="600" fill={ink}>
        {text}
      </text>
    )}
  </g>
);

const Label = ({ x, y, children, anchor = 'start', fill = INK_2, size = 9.5 }: { x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end'; fill?: string; size?: number }) => (
  <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={SANS} fontSize={size} fill={fill}>
    {children}
  </text>
);

const Strike = ({ y, children, fill = INK_2 }: { y: number; children: string; fill?: string }) => (
  <text x={38} y={y + 0.5} textAnchor="end" dominantBaseline="middle" fontFamily={MONO} fontSize="9" fill={fill}>
    {children}
  </text>
);

/** FIGURE 1 — SIZE: one strike, one capsule; length is the weight, colour the lean */
const SizeFigure = () => {
  const rows = [
    { y: 20, k: '497', w: 58, fill: COOL_1, text: '$94M' },
    { y: 42, k: '496', w: 92, fill: COOL_2, text: '$110M' },
    { y: 64, k: '495', w: 214, fill: COOL_3, text: '$256M', ink: '#ffffff', wall: true },
    { y: 86, k: '494', w: 66, fill: WARM_1, text: '$61M' },
    { y: 108, k: '493', w: 128, fill: WARM_2, text: '$131M' },
  ];
  return (
    <svg viewBox="0 0 368 166" width="100%" role="img" aria-label="Five strikes, each with one capsule whose length is the hedging parked there; the longest is the call wall" data-guide-figure="size">
      {rows.map(r => (
        <line key={r.k} x1={44} x2={362} y1={r.y + 0.5} y2={r.y + 0.5} stroke={GRID} />
      ))}
      {rows.map(r => (
        <g key={r.k}>
          <Strike y={r.y} fill={r.wall ? 'rgb(var(--bull))' : INK_2}>
            {r.k}
          </Strike>
          <Capsule x={46} y={r.y} w={r.w} fill={r.fill} text={r.text} ink={r.ink ?? '#0a0a0a'} />
        </g>
      ))}
      {/* The wall, named, with a leader to its capsule's end */}
      <line x1={262} x2={272} y1={64.5} y2={64.5} stroke="rgba(48,209,88,0.5)" />
      <rect x={272} y={56} width={54} height={16} rx={8} fill="rgba(48,209,88,0.14)" stroke="rgba(48,209,88,0.5)" />
      <Label x={299} y={64} anchor="middle" fill="#30D158" size={9}>
        Call wall
      </Label>
      <Label x={332} y={64} fill={INK_3} size={9}>
        longest
      </Label>
      {/* What the drawing says, in three lines */}
      <circle cx={50} cy={128} r={4} fill={SILVER} />
      <Label x={59} y={128}>one strike, one capsule · longer means more hedging sits there</Label>
      <circle cx={50} cy={143} r={4} fill={COOL_2} />
      <Label x={59} y={143}>blue · pushes back — dealers buy the dips and sell the rips here</Label>
      <circle cx={50} cy={158} r={4} fill={WARM_2} />
      <Label x={59} y={158}>orange · pushes along — dealers chase the move here</Label>
    </svg>
  );
};

/** FIGURE 2 — FLOW: a trip from spot to a strike; every strike crossed adds its weight */
const FlowFigure = () => {
  const spotY = 116;
  const steps = [
    { y: 88, k: '493', add: '+$30M', total: 34, text: '$30M' },
    { y: 60, k: '494', add: '+$45M', total: 82, text: '$75M' },
    { y: 32, k: '495', add: '+$69M', total: 150, text: 'sell $144M' },
  ];
  return (
    <svg viewBox="0 0 368 162" width="100%" role="img" aria-label="A move from spot up to 495 crosses three strikes; each adds its weight and the running total on arrival is the forced flow" data-guide-figure="flow">
      {/* The price axis */}
      <line x1={44} x2={44} y1={16} y2={132} stroke={GRID} />
      {steps.map(s => (
        <line key={s.k} x1={44} x2={200} y1={s.y + 0.5} y2={s.y + 0.5} stroke={GRID} />
      ))}
      {/* Spot, the chip */}
      <rect x={14} y={spotY - 8} width={46} height={16} rx={4} fill={INK} />
      <text x={37} y={spotY + 0.5} textAnchor="middle" dominantBaseline="middle" fontFamily={MONO} fontSize="9" fontWeight="700" fill="#0a0a0a">
        492.40
      </text>
      <Label x={66} y={spotY} fill={INK_3}>where the market is now</Label>
      {/* The trip: a dotted path up the axis, with an arrowhead */}
      <line x1={44} x2={44} y1={spotY - 10} y2={40} stroke={SILVER} strokeWidth="1.25" strokeDasharray="2 3" />
      <path d="M40 42 L44 34 L48 42" fill="none" stroke={SILVER} strokeWidth="1.25" />
      {/* Each strike crossed adds its weight */}
      {steps.map((s, i) => (
        <g key={s.k}>
          <Strike y={s.y}>{s.k}</Strike>
          <circle cx={44} cy={s.y} r={3} fill={SILVER} />
          <Capsule x={54} y={s.y} w={44} fill={i === 2 ? COOL_3 : i === 1 ? COOL_2 : COOL_1} text={s.add} ink={i === 2 ? '#ffffff' : '#0a0a0a'} h={12} />
          {/* The running total on the right, growing with every strike crossed */}
          <Capsule x={208} y={s.y} w={s.total} fill={i === 2 ? WARM_3 : i === 1 ? WARM_2 : WARM_1} text={s.text} ink={i === 2 ? '#ffffff' : '#0a0a0a'} />
        </g>
      ))}
      <Label x={110} y={88} fill={INK_3}>crossed first</Label>
      <Label x={110} y={60} fill={INK_3}>then this one</Label>
      <Label x={110} y={32} fill={INK_3}>arrives here</Label>
      <Label x={208} y={16} fill={SILVER}>the bill so far</Label>
      <Label x={14} y={139} fill={INK_3}>every strike crossed adds what sits there to the bill</Label>
      <Label x={14} y={153} fill={INK_3}>the total on arrival is what the lane shows</Label>
    </svg>
  );
};

interface ProfileGuideProps {
  rows: GexLevel[];
  levels: PanelLevels;
  flow: FlowLadder | null;
}

const ProfileGuide = ({ rows, levels, flow }: ProfileGuideProps) => {
  const sizeAt = (k: number) => rows.find(r => near(r.strike, k))?.value ?? 0;
  const rungAt = (k: number) => flow?.rungs.find(r => near(r.strike, k));
  const example = (label: string, k: number) => {
    const v = sizeAt(k);
    const g = rungAt(k);
    const up = k > levels.spot;
    if (!v || !g || g.flow === 0) return null;
    return (
      <li key={label} className="text-[11.5px] leading-relaxed text-textSecondary">
        The {label} at <span className="font-mono tnum text-textPrimary">{fmtStrike(k)}</span> has{' '}
        <span className="font-mono tnum text-textPrimary">{fmtUsd(Math.abs(v))}</span> of hedging sitting on it, and it {v > 0 ? 'pushes moves along' : 'pushes back against moves'}. For price to{' '}
        {up ? 'climb' : 'fall'} to it, dealers would have to{' '}
        <span className="font-mono tnum text-textPrimary">
          {g.flow >= 0 ? 'buy' : 'sell'} {fmtFlow(g.flow)}
        </span>{' '}
        on the way, which {g.amplifies ? 'speeds that move up' : 'slows that move down'}.
      </li>
    );
  };
  const examples = [example('call wall', levels.callWall), example('put wall', levels.putWall)].filter(Boolean);

  return (
    <div className="px-3 py-3 flex flex-col gap-3" data-profile-guide-card>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">Size · what sits at each strike</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          Each capsule is one strike. Its length is how much hedging dealers have sitting there: the more, the longer. That is why the walls are the longest. Blue means their hedging pushes back against a move at that strike. Orange means it pushes the move along.
        </p>
        <div className="mt-2 rounded-md border border-borderSubtle/60 bg-panel px-2 py-2">
          <SizeFigure />
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">What a move forces · what it costs to get there</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          Pick a strike. To reach it, price has to cross every strike in between, and each one adds its hedging to the bill. The capsule shows the total dealers would have to buy or sell by the time price arrives, so it grows the further the strike is from where the market is now. Orange means that trading pushes the move along, so it speeds up. Blue means it pushes back, so it slows down.
        </p>
        <div className="mt-2 rounded-md border border-borderSubtle/60 bg-panel px-2 py-2">
          <FlowFigure />
        </div>
      </div>
      {examples.length > 0 && (
        <div className="border-t border-borderSubtle/60 pt-2.5">
          <p className="text-[10px] text-textMuted">Today, read both ways</p>
          <ul className="mt-1 flex flex-col gap-1.5">{examples}</ul>
        </div>
      )}
      <p className="text-[10px] text-textMuted">Hover any strike to see both numbers in the line under the lanes · click to keep it there.</p>
    </div>
  );
};

export default ProfileGuide;
