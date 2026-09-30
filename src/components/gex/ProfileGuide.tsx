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
import { splinePath } from './spline';

const INK = 'rgb(var(--text-primary))';
const INK_2 = 'rgb(var(--text-secondary))';
const INK_3 = 'rgb(var(--text-muted))';
const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const GRID = 'rgb(var(--ink) / 0.07)';
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

/* The thermal ramp's journey from the centre's pale yellow out to a pole — the
   legs' own surface, at the strength each leg earns */
const YELLOW = '#FFFFBF';
const hexRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hexRgb(a);
  const [r2, g2, b2] = hexRgb(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
};
const rampAt = (stops: string[], t: number) => {
  const tt = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(tt));
  return mix(stops[i], stops[i + 1], tt - i);
};
const WARM_RAMP = [YELLOW, WARM_1, WARM_2, WARM_3];
const COOL_RAMP = [YELLOW, COOL_1, COOL_2, COOL_3];

/** FIGURE 1 — SIZE: the ladder; puts grow left, calls grow right, the spine leans to the side that wins */
const SizeFigure = () => {
  const MID = 200;
  const REACH = 112;
  const LEAN = 58;
  const rows = [
    { y: 20, k: '497', put: 18, call: 94 },
    { y: 42, k: '496', put: 40, call: 150 },
    { y: 64, k: '495', put: 22, call: 256, wall: 'call' as const },
    { y: 86, k: '494', put: 131, call: 35 },
    { y: 108, k: '493', put: 210, call: 12, wall: 'put' as const },
  ];
  const legMax = 256;
  const netMax = Math.max(...rows.map(r => Math.abs(r.put - r.call)));
  const spineX = (r: { put: number; call: number }) => MID - ((r.put - r.call) / netMax) * LEAN;
  const spine = splinePath(rows.map(r => ({ x: spineX(r), y: r.y })), MID - LEAN - 4, MID + LEAN + 4);
  const ghost = splinePath(rows.map(r => ({ x: MID + (spineX(r) - MID) * 0.55, y: r.y })), MID - LEAN - 4, MID + LEAN + 4);
  const H = 6;
  const wallInk = (w: 'call' | 'put' | undefined) => (w === 'call' ? 'rgb(var(--bull))' : w === 'put' ? 'rgb(var(--bear))' : INK_2);
  return (
    <svg viewBox="0 0 368 166" width="100%" role="img" aria-label="Five strikes on the ladder: the put leg grows left from a centre line, the call leg grows right, and one line leans through the rows toward the side that wins each strike" data-guide-figure="size">
      <defs>
        {rows.map(r => {
          const ps = r.put / legMax;
          const cs = r.call / legMax;
          return (
            <g key={r.k}>
              <linearGradient id={`g-put-${r.k}`} x1="1" x2="0" y1="0" y2="0">
                <stop offset="0" stopColor={YELLOW} />
                <stop offset="0.33" stopColor={rampAt(WARM_RAMP, ps / 3)} />
                <stop offset="0.66" stopColor={rampAt(WARM_RAMP, (2 * ps) / 3)} />
                <stop offset="1" stopColor={rampAt(WARM_RAMP, ps)} />
              </linearGradient>
              <linearGradient id={`g-call-${r.k}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor={YELLOW} />
                <stop offset="0.33" stopColor={rampAt(COOL_RAMP, cs / 3)} />
                <stop offset="0.66" stopColor={rampAt(COOL_RAMP, (2 * cs) / 3)} />
                <stop offset="1" stopColor={rampAt(COOL_RAMP, cs)} />
              </linearGradient>
            </g>
          );
        })}
      </defs>
      {rows.map(r => (
        <line key={r.k} x1={44} x2={362} y1={r.y + 0.5} y2={r.y + 0.5} stroke={GRID} />
      ))}
      {/* the centre line */}
      <line x1={MID + 0.5} x2={MID + 0.5} y1={8} y2={120} stroke="rgba(255,255,255,0.10)" />
      {rows.map(r => {
        const pl = (r.put / legMax) * REACH;
        const cl = (r.call / legMax) * REACH;
        return (
          <g key={r.k}>
            <Strike y={r.y} fill={wallInk(r.wall)}>
              {r.k}
            </Strike>
            {r.wall && <rect x={44} y={r.y - 7} width={2} height={14} fill={wallInk(r.wall)} />}
            <rect x={MID - pl} y={r.y - H / 2} width={pl} height={H} rx={2} fill={`url(#g-put-${r.k})`} />
            <rect x={MID} y={r.y - H / 2} width={cl} height={H} rx={2} fill={`url(#g-call-${r.k})`} />
            <text x={MID - pl - 4} y={r.y + 0.5} textAnchor="end" dominantBaseline="middle" fontFamily={MONO} fontSize="9" fill={INK}>
              ${r.put}M
            </text>
            <text x={MID + cl + 4} y={r.y + 0.5} textAnchor="start" dominantBaseline="middle" fontFamily={MONO} fontSize="9" fill={INK}>
              ${r.call}M
            </text>
          </g>
        );
      })}
      {/* the spine and its ghost at the open */}
      <path d={ghost} fill="none" stroke="rgba(237,237,237,0.35)" strokeWidth={1} strokeDasharray="3 3" />
      <path d={spine} fill="none" stroke="rgba(237,237,237,0.85)" strokeWidth={1.5} />
      {/* What the drawing says, in three lines */}
      <circle cx={50} cy={128} r={4} fill={SILVER} />
      <Label x={59} y={128}>puts grow left, calls grow right · longer is more hedging</Label>
      <circle cx={50} cy={143} r={4} fill={WARM_2} />
      <Label x={59} y={143}>puts push moves along · calls push back · hotter is heavier</Label>
      <line x1={45} x2={55} y1={158.5} y2={158.5} stroke="rgba(237,237,237,0.85)" strokeWidth={1.5} />
      <Label x={59} y={158}>the line leans to the side that wins · dashed is at the open</Label>
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
      <text x={37} y={spotY + 0.5} textAnchor="middle" dominantBaseline="middle" fontFamily={MONO} fontSize="9" fontWeight="700" fill="rgb(var(--panel))">
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
          Each row is one strike. The put hedging grows left from the centre line and the call hedging grows right: the more sits there, the longer the leg and the hotter its colour. That is why the walls are the longest. The put side pushes moves along at that strike; the call side pushes back. The line through the rows leans to whichever side wins each strike, and the dashed line is where it leaned at the open.
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
