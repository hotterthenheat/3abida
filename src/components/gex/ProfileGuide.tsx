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
import type { PanelLevels, ProfilePalette } from './ProfilePanel';
import { HEAT_MODE, heatCellStyle, type HeatMode } from './heatmap';
import { num } from '../../core/format';
import { splinePath } from './spline';
import { FONT_SANS } from '../../theme/fonts';
import { GuideSvg } from '../ui/GuideSvg';

const INK = 'rgb(var(--text-primary))';
const INK_2 = 'rgb(var(--text-secondary))';
const INK_3 = 'rgb(var(--text-muted))';
const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const GRID = 'rgb(var(--ink) / 0.07)';
/* THE LADDER'S OWN INKS (the audit's C-36: the figures stood in the old thermal hexes, orange and blue, beside a ladder
   drawing gold and violet): every fill is the ladder's heat cell at that strength (heatmap.ts heatCellStyle — the
   reader's palette, House or Thermal, and the colour-vision pair), on the guide's dark card */
export type Heat = (v: number) => { fill: string; ink: string };
/* the figures' voice — Helvetica's digits are tabular (theme/fonts.ts) */
const FIG = FONT_SANS;
const SANS = FONT_SANS;

const fmtStrike = (v: number) => (!Number.isFinite(v) ? '—' : v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** A capsule with its figure inside, the panel's own drawing */
const Capsule = ({ x, y, w, fill, text, ink = 'rgb(var(--on-silver))', h = 14, s }: { x: number; y: number; w: number; fill: string; text?: string; ink?: string; h?: number; s: number }) => (
  <g>
    <rect x={x} y={y - h / 2} width={w} height={h} rx={h / 2} fill={fill} />
    {text && (
      <text x={x + w - 6} y={y + 0.5} textAnchor="end" dominantBaseline="middle" fontFamily={FIG} fontSize={s} fontWeight="600" fill={ink}>
        {text}
      </text>
    )}
  </g>
);

const Label = ({ x, y, children, anchor = 'start', fill = INK_2, size }: { x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end'; fill?: string; size: number }) => (
  <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={SANS} fontSize={size} fill={fill}>
    {children}
  </text>
);

const Strike = ({ y, children, fill = INK_2, s }: { y: number; children: string; fill?: string; s: number }) => (
  <text x={38} y={y + 0.5} textAnchor="end" dominantBaseline="middle" fontFamily={FIG} fontSize={s} fill={fill}>
    {children}
  </text>
);

/* THE FIGURES' STRIKES ARE THE PANE'S (the audit's TE-14: the guide's 493–497 stood beside a market at 477): the five
   strikes over the name's own price, a strike apart on its own grid — the shapes stay the drawing's */
const strikesOver = (spot: number, step: number, n: number) => {
  const first = Math.ceil((spot + 1e-9) / step) * step;
  return Array.from({ length: n }, (_, i) => fmtStrike(Number((first + i * step).toFixed(2))));
};

/** FIGURE 1 — SIZE: the ladder; puts grow left, calls grow right, the spine leans to the side that wins */
const SizeFigure = ({ ks, heat }: { ks: string[]; heat: Heat }) => {
  const MID = 200;
  const REACH = 112;
  const LEAN = 58;
  const rows = [
    { y: 20, k: ks[4], put: 18, call: 94 },
    { y: 42, k: ks[3], put: 40, call: 150 },
    { y: 64, k: ks[2], put: 22, call: 256, wall: 'call' as const },
    { y: 86, k: ks[1], put: 131, call: 35 },
    { y: 108, k: ks[0], put: 210, call: 12, wall: 'put' as const },
  ];
  const legMax = 256;
  const netMax = Math.max(...rows.map(r => Math.abs(r.put - r.call)));
  const spineX = (r: { put: number; call: number }) => MID - ((r.put - r.call) / netMax) * LEAN;
  const spine = splinePath(rows.map(r => ({ x: spineX(r), y: r.y })), MID - LEAN - 4, MID + LEAN + 4);
  const ghost = splinePath(rows.map(r => ({ x: MID + (spineX(r) - MID) * 0.55, y: r.y })), MID - LEAN - 4, MID + LEAN + 4);
  const H = 6;
  /* the walls wear the gamma pair, as on the chart and the ladder: the call wall the absorbing gold, the put wall violet */
  const wallInk = (w: 'call' | 'put' | undefined) => (w === 'call' ? 'rgb(var(--absorb))' : w === 'put' ? 'rgb(var(--amplify))' : INK_2);
  return (
    <GuideSvg w={368} h={166} word={9.75} label="Five strikes on the ladder: the put leg grows left from a centre line, the call leg grows right, and one line leans through the rows toward the side that wins each strike" figure="size">
      {({ w, t }) => (
        <>
          <defs>
            {rows.map(r => {
              const ps = r.put / legMax;
              const cs = r.call / legMax;
              return (
                <g key={r.k}>
                  <linearGradient id={`g-put-${r.k}`} x1="1" x2="0" y1="0" y2="0">
                    <stop offset="0" stopColor={heat(0).fill} />
                    <stop offset="0.33" stopColor={heat(ps / 3).fill} />
                    <stop offset="0.66" stopColor={heat((2 * ps) / 3).fill} />
                    <stop offset="1" stopColor={heat(ps).fill} />
                  </linearGradient>
                  <linearGradient id={`g-call-${r.k}`} x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor={heat(0).fill} />
                    <stop offset="0.33" stopColor={heat(-cs / 3).fill} />
                    <stop offset="0.66" stopColor={heat((-2 * cs) / 3).fill} />
                    <stop offset="1" stopColor={heat(-cs).fill} />
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
                <Strike s={w} y={r.y} fill={wallInk(r.wall)}>
                  {r.k}
                </Strike>
                {r.wall && <rect x={44} y={r.y - 7} width={2} height={14} fill={wallInk(r.wall)} />}
                <rect x={MID - pl} y={r.y - H / 2} width={pl} height={H} rx={2} fill={`url(#g-put-${r.k})`} />
                <rect x={MID} y={r.y - H / 2} width={cl} height={H} rx={2} fill={`url(#g-call-${r.k})`} />
                <text x={MID - pl - 4} y={r.y + 0.5} textAnchor="end" dominantBaseline="middle" fontFamily={FIG} fontSize={w} fill={INK}>
                  ${r.put}M
                </text>
                <text x={MID + cl + 4} y={r.y + 0.5} textAnchor="start" dominantBaseline="middle" fontFamily={FIG} fontSize={w} fill={INK}>
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
          <Label x={59} y={128} size={w}>puts grow left, calls grow right · longer is more hedging</Label>
          <circle cx={50} cy={143} r={4} fill={heat(0.66).fill} />
          <Label x={59} y={143} size={w}>puts push moves along · calls push back · hotter is heavier</Label>
          <line x1={45} x2={55} y1={158.5} y2={158.5} stroke="rgba(237,237,237,0.85)" strokeWidth={1.5} />
          <Label x={59} y={158} size={w}>the line leans to the side that wins · dashed is at the open</Label>
        </>
      )}
    </GuideSvg>
  );
};

/** FIGURE 2 — FLOW: a trip from spot to a strike; every strike crossed adds its weight */
const FlowFigure = ({ ks, spot, heat }: { ks: string[]; spot: string; heat: Heat }) => {
  const spotY = 116;
  const steps = [
    { y: 88, k: ks[0], add: '+$30M', total: 34, text: '$30M' },
    { y: 60, k: ks[1], add: '+$45M', total: 82, text: '$75M' },
    { y: 32, k: ks[2], add: '+$69M', total: 150, text: 'sell $144M' },
  ];
  return (
    <GuideSvg w={368} h={162} word={9.75} label={`A move from spot up to ${ks[2]} crosses three strikes; each adds its weight and the running total on arrival is the forced flow`} figure="flow">
      {({ w, t }) => (
        <>
          {/* The price axis */}
          <line x1={44} x2={44} y1={16} y2={132} stroke={GRID} />
          {steps.map(s => (
            <line key={s.k} x1={44} x2={200} y1={s.y + 0.5} y2={s.y + 0.5} stroke={GRID} />
          ))}
          {/* Spot, the chip */}
          <rect x={14} y={spotY - 8} width={46} height={16} rx={4} fill={INK} />
          <text x={37} y={spotY + 0.5} textAnchor="middle" dominantBaseline="middle" fontFamily={FIG} fontSize={w} fontWeight="700" fill="rgb(var(--panel))">
            {spot}
          </text>
          <Label x={66} y={spotY} fill={INK_3} size={w}>where the market is now</Label>
          {/* The trip: a dotted path up the axis, with an arrowhead */}
          <line x1={44} x2={44} y1={spotY - 10} y2={40} stroke={SILVER} strokeWidth="1.25" strokeDasharray="2 3" />
          <path d="M40 42 L44 34 L48 42" fill="none" stroke={SILVER} strokeWidth="1.25" />
          {/* Each strike crossed adds its weight */}
          {steps.map((s, i) => (
            <g key={s.k}>
              <Strike s={w} y={s.y}>{s.k}</Strike>
              <circle cx={44} cy={s.y} r={3} fill={SILVER} />
              <Capsule s={w} x={54} y={s.y} w={44} fill={heat(-(i + 1) / 3).fill} text={s.add} ink={heat(-(i + 1) / 3).ink} h={12} />
              {/* The running total on the right, growing with every strike crossed */}
              <Capsule s={w} x={208} y={s.y} w={s.total} fill={heat((i + 1) / 3).fill} text={s.text} ink={heat((i + 1) / 3).ink} />
            </g>
          ))}
          <Label x={110} y={88} fill={INK_3} size={w}>crossed first</Label>
          <Label x={110} y={60} fill={INK_3} size={w}>then this one</Label>
          <Label x={110} y={32} fill={INK_3} size={w}>arrives here</Label>
          <Label x={208} y={16} fill={SILVER} size={w}>the bill so far</Label>
          <Label x={14} y={139} fill={INK_3} size={w}>every strike crossed adds what sits there to the bill</Label>
          <Label x={14} y={153} fill={INK_3} size={w}>the total on arrival is what the lane shows</Label>
        </>
      )}
    </GuideSvg>
  );
};

interface ProfileGuideProps {
  rows: GexLevel[];
  levels: PanelLevels;
  flow: FlowLadder | null;
  /** The ladder's colours — the guide draws in the same */
  palette?: ProfilePalette;
}

const ProfileGuide = ({ rows, levels, flow, palette = 'house' }: ProfileGuideProps) => {
  /* the ladder's heat cell on the guide's dark card, the reader's palette (heatCellStyle reads the colour-vision pair) */
  const mode: HeatMode = palette === 'house' ? HEAT_MODE : 'thermal-yellow';
  const heat: Heat = v => {
    const c = heatCellStyle(v, 1, mode, false);
    return { fill: String(c.backgroundColor ?? 'rgb(var(--panel))'), ink: String(c.color ?? 'rgb(var(--text-primary))') };
  };
  /* the name's own grid: the smallest gap between two of its strikes */
  let step = Infinity;
  const asc = rows.map(r => r.strike).sort((a, b) => a - b);
  for (let i = 1; i < asc.length; i++) if (asc[i] - asc[i - 1] > 1e-9) step = Math.min(step, asc[i] - asc[i - 1]);
  if (!Number.isFinite(step)) step = 1;
  const ks = strikesOver(levels.spot, step, 5);
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
          <SizeFigure ks={ks} heat={heat} />
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-textPrimary">What a move forces · what it costs to get there</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">
          Pick a strike. To reach it, price has to cross every strike in between, and each one adds its hedging to the bill. The capsule shows the total dealers would have to buy or sell by the time price arrives, so it grows the further the strike is from where the market is now. Violet means that trading pushes the move along, so it speeds up. Gold means it pushes back, so it slows down (the House colours; Thermal draws them warm and cool).
        </p>
        <div className="mt-2 rounded-md border border-borderSubtle/60 bg-panel px-2 py-2">
          <FlowFigure ks={ks} spot={num(levels.spot, 2)} heat={heat} />
        </div>
      </div>
      {examples.length > 0 && (
        <div className="border-t border-borderSubtle/60 pt-2.5">
          <p className="text-[11px] text-textMuted">Today, read both ways</p>
          <ul className="mt-1 flex flex-col gap-1.5">{examples}</ul>
        </div>
      )}
      {/* THE FIELD ON THE CHART, one line (2026-10-13): which beads were read as they stood and which were rebuilt, and the
          scale they share */}
      <p className="text-[11px] text-textMuted" data-guide-field>
        On the chart, each oval is estimated dealer gamma (assumed sign) at one strike and one candle: its size the strike's total gamma against the session's largest node so far, its colour the side that wins — gold absorbs, violet amplifies, grey is balanced. On the feed every minute is modeled from what was known by then; an oval with a soft edge stands on stale or carried vols — hover it for which, and for Unusual Whales' own figure beside it. Each column's grey ticks are its own flip, a gap where it has none; a wall's move comes from price, vol or time, never new positions.
      </p>
      <p className="text-[11px] text-textMuted">Hover any strike to see both numbers in the line under the lanes · click to keep it there.</p>
    </div>
  );
};

export default ProfileGuide;
