/*
==================================================
  SLAYER TERMINAL - THE POSITION CARD
  (components/gex/PositionCard.tsx)

  One contract, one picture. The grammar is
  TradingView's strategy builder and Robinhood's
  holding card, the two references Noah kept
  (2026-09-05): the contract as the title, ONE
  verdict chip, a payoff sketch — profit or loss
  across price, the hard line at expiry with soft
  green and red fills, the soft line for today —
  and, the thing no builder has, the dealer map's
  walls and flip drawn on the same price axis so
  "hedging works against you above 507.50" is a
  line on the curve, not a sentence in a cell.

  THE SKETCH ANSWERS THE CURSOR (Noah: "shouldn't
  the cards have hover effects on the literal
  chart making it breathe"): a hairline follows the
  pointer, a dot on each line, the price under the
  axis, and a small card — the price and how far it
  is from now, profit at expiry and today, and what
  dealers do at that price and where it sits
  against the nearest level. The fills come up a
  shade while the pointer is on the chart.

  Under the sketch, five facts as small labels over
  values, divided by air. Then the sentence. Then
  the three things you can do.

  THE COLOURWAY IS DELIBERATELY QUIET: one neutral
  ground, the house silver for today's line and the
  spot, green and red only for profit and loss, the
  levels as hairlines. Nothing else wears colour.
==================================================
*/

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowUpRight, Pencil, X } from 'lucide-react';
import PositionForm from './PositionForm';
import { buildPositionCurve, fmtPnl, type PositionCurve } from '../../data/positionCurve';
import { removePosition, subjectWords, type Position, type PositionRead, type Verdict } from '../../data/positions';
import { fmtUsd } from '../../data/gex';
import type { ExposureLevels } from '../../types/gex';
import { TickerText } from '../ui/Name';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const GREEN = 'rgb(var(--bull))';
const RED = 'rgb(var(--bear))';
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  with: { label: 'Hedging with you', cls: 'bg-bull/10 text-bull border-bull/20' },
  against: { label: 'Hedging against you', cls: 'bg-bear/10 text-bear border-bear/20' },
  mixed: { label: 'Hedging both ways', cls: 'bg-ink/[0.05] text-textSecondary border-borderSubtle' },
};

// ---- the sketch ----------------------------------------------------------------

const W = 600;
const H = 176;
/* Two rows of level labels fit in the top margin — neighbours that would
   collide take turns */
const M = { l: 48, r: 14, t: 30, b: 22 };
const LABEL_ROWS = [11, 22];
const MONO = 'ui-monospace, Menlo, monospace';

/** What dealers do at a price, and where it sits against the nearest level */
function priceWords(price: number, levels: ExposureLevels, wantsUp: boolean): { dealers: string; withYou: boolean; where: string } {
  const absorb = price > levels.flip;
  const withYou = wantsUp ? !absorb : !absorb;
  const named: { k: number; name: string }[] = [
    { k: levels.callWall, name: 'the call wall' },
    { k: levels.putWall, name: 'the put wall' },
    { k: levels.flip, name: 'the flip' },
  ];
  const near = named.reduce((b, l) => (Math.abs(l.k - price) < Math.abs(b.k - price) ? l : b), named[0]);
  const d = price - near.k;
  const where = Math.abs(d) < 0.05 ? `at ${near.name}` : `${Math.abs(d).toFixed(2)} ${d > 0 ? 'above' : 'under'} ${near.name}`;
  return { dealers: absorb ? 'Dealers absorb moves here' : 'Dealers amplify moves here', withYou, where };
}

interface SketchProps {
  curve: PositionCurve;
  spot: number;
  levels: ExposureLevels;
  strike: number;
  wantsUp: boolean;
}

const PayoffSketch = ({ curve, spot, levels, strike, wantsUp }: SketchProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const { points, lo, hi } = curve;
  let vMin = 0;
  let vMax = 0;
  for (const p of points) {
    vMin = Math.min(vMin, p.expiry, p.now);
    vMax = Math.max(vMax, p.expiry, p.now);
  }
  if (vMax === vMin) vMax = vMin + 1;
  const pad = (vMax - vMin) * 0.1;
  vMin -= pad;
  vMax += pad;
  const x = (price: number) => M.l + ((price - lo) / (hi - lo)) * iw;
  const y = (v: number) => M.t + (1 - (v - vMin) / (vMax - vMin)) * ih;
  const y0 = y(0);
  const path = (key: 'expiry' | 'now') => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.price).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const area = `${path('expiry')} L${x(hi).toFixed(1)},${y0.toFixed(1)} L${x(lo).toFixed(1)},${y0.toFixed(1)} Z`;
  const clipId = `clip-${strike}-${Math.round(spot * 100)}`;
  /* The levels, left to right; a label within 90 units of the one before it
     drops to the second row so the two never print over each other */
  const levelLines = [
    { price: levels.putWall, label: `put wall ${fmtStrike(levels.putWall)}`, row: 0 },
    { price: levels.flip, label: `flip ${fmtStrike(levels.flip)}`, row: 0 },
    { price: levels.callWall, label: `call wall ${fmtStrike(levels.callWall)}`, row: 0 },
  ]
    .filter(l => l.price > lo && l.price < hi)
    .sort((a, b) => a.price - b.price);
  for (let i = 1; i < levelLines.length; i++) {
    const prev = levelLines[i - 1];
    if (x(levelLines[i].price) - x(prev.price) < 90) levelLines[i].row = prev.row === 0 ? 1 : 0;
  }
  const yTicks = [vMax - pad, 0, vMin + pad];
  const pt = hover != null ? points[hover] : null;
  /* Price ticks, minus any that would print under the "now" label or the cursor's */
  const xTicks = [lo, lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.75, hi].filter(v => Math.abs(x(v) - x(spot)) > 48 && (!pt || Math.abs(x(v) - x(pt.price)) > 48));
  const spotNow = points.reduce((b, p) => (Math.abs(p.price - spot) < Math.abs(b.price - spot) ? p : b), points[0]);

  /* The cursor → the nearest sampled price */
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const u = ((e.clientX - r.left) / r.width) * W;
    const t = Math.max(0, Math.min(1, (u - M.l) / iw));
    setHover(Math.round(t * (points.length - 1)));
  };

  const words = pt ? priceWords(pt.price, levels, wantsUp) : null;
  const cardLeftPct = pt ? (x(pt.price) / W) * 100 : 0;
  const cardOnRight = pt ? x(pt.price) < W * 0.6 : true;
  const hovering = pt != null;

  return (
    <div className="relative" data-sketch onPointerLeave={() => setHover(null)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Profit or loss across price, at expiry and today, with the dealer levels marked"
        data-payoff
        style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
        onPointerMove={onMove}
        onPointerDown={onMove}
      >
        <defs>
          <clipPath id={`${clipId}-up`}>
            <rect x={M.l} y={M.t - 2} width={iw} height={Math.max(0, y0 - M.t + 2)} />
          </clipPath>
          <clipPath id={`${clipId}-down`}>
            <rect x={M.l} y={y0} width={iw} height={Math.max(0, H - M.b - y0 + 2)} />
          </clipPath>
        </defs>
        {/* the faint grid and the zero line */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#ffffff" strokeOpacity={v === 0 ? 0.22 : 0.06} strokeWidth={1} />
            <text x={M.l - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#7c8290" fontFamily={MONO}>
              {fmtPnl(v)}
            </text>
          </g>
        ))}
        {/* the fills: green above zero, red below — a shade brighter under the pointer */}
        <path d={area} fill={GREEN} clipPath={`url(#${clipId}-up)`} style={{ fillOpacity: hovering ? 0.22 : 0.14, transition: 'fill-opacity 220ms ease-out' }} />
        <path d={area} fill={RED} clipPath={`url(#${clipId}-down)`} style={{ fillOpacity: hovering ? 0.22 : 0.14, transition: 'fill-opacity 220ms ease-out' }} />
        {/* the dealer levels — hairlines with small words at the top */}
        {levelLines.map(l => (
          <g key={l.label}>
            <line x1={x(l.price)} x2={x(l.price)} y1={LABEL_ROWS[l.row] + 3} y2={H - M.b} stroke="#ffffff" strokeOpacity={0.16} strokeWidth={1} strokeDasharray="2 3" />
            <text x={x(l.price)} y={LABEL_ROWS[l.row]} textAnchor="middle" fontSize={8.5} fill="#8a909c" fontFamily={MONO} data-level-label>
              {l.label}
            </text>
          </g>
        ))}
        {/* today's line, then the hard line at expiry */}
        <path d={path('now')} fill="none" stroke={SILVER} strokeWidth={1.25} strokeDasharray="3 3" style={{ strokeOpacity: hovering ? 1 : 0.8, transition: 'stroke-opacity 220ms ease-out' }} />
        <path d={path('expiry')} fill="none" stroke={GREEN} strokeWidth={1.5} clipPath={`url(#${clipId}-up)`} />
        <path d={path('expiry')} fill="none" stroke={RED} strokeWidth={1.5} clipPath={`url(#${clipId}-down)`} />
        {/* your strike — a small tick on the zero line */}
        <path d={`M${x(strike)},${y0 + 5} l-4,6 h8 z`} fill="#ededed" fillOpacity={0.7} />
        {/* now — the spot, on today's line */}
        <line x1={x(spot)} x2={x(spot)} y1={M.t} y2={H - M.b} stroke={SILVER} strokeOpacity={0.35} strokeWidth={1} />
        <circle cx={x(spot)} cy={y(spotNow.now)} r={3} fill={SILVER} stroke="#0a0a0a" strokeWidth={1.5} />
        {/* the price axis */}
        {xTicks.map(v => (
          <text key={v} x={x(v)} y={H - 6} textAnchor={v === lo ? 'start' : v === hi ? 'end' : 'middle'} fontSize={9} fill="#7c8290" fontFamily={MONO} data-x-tick>
            {fmtStrike(Math.round(v * 2) / 2)}
          </text>
        ))}
        <text x={x(spot)} y={H - 6} textAnchor="middle" fontSize={9} fontWeight={600} fill={SILVER} fontFamily={MONO} data-now-label style={{ paintOrder: 'stroke', stroke: '#0e0e0f', strokeWidth: 4 }}>
          now {spot.toFixed(2)}
        </text>
        {/* THE CURSOR — a hairline, a dot on each line, the price under the axis */}
        {pt && (
          <g data-cursor>
            <line x1={x(pt.price)} x2={x(pt.price)} y1={M.t} y2={H - M.b} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1} />
            <circle cx={x(pt.price)} cy={y(pt.now)} r={3} fill="#0e0e0f" stroke={SILVER} strokeWidth={1.5} />
            <circle cx={x(pt.price)} cy={y(pt.expiry)} r={3.5} fill={pt.expiry >= 0 ? GREEN : RED} stroke="#0e0e0f" strokeWidth={1.5} />
            {Math.abs(x(pt.price) - x(spot)) > 48 && (
              <text x={x(pt.price)} y={H - 6} textAnchor="middle" fontSize={9} fontWeight={600} fill="#ededed" fontFamily={MONO} style={{ paintOrder: 'stroke', stroke: '#0e0e0f', strokeWidth: 4 }}>
                {pt.price.toFixed(2)}
              </text>
            )}
          </g>
        )}
      </svg>
      {/* THE HOVER CARD — small, and only what the cursor asked */}
      {pt && words && (
        <div
          data-hover-card
          className="absolute top-[34px] pointer-events-none rounded-lg border border-borderMuted bg-card/95 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.5)] px-3 py-2 w-[196px] animate-soft-in"
          style={{ left: `${cardLeftPct}%`, transform: cardOnRight ? 'translateX(14px)' : 'translateX(calc(-100% - 14px))' }}
        >
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[12px] font-semibold tnum text-textPrimary">{pt.price.toFixed(2)}</span>
            <span className="font-mono text-[10px] tnum text-textMuted">
              {pt.price >= spot ? '+' : ''}
              {(((pt.price - spot) / spot) * 100).toFixed(2)}% from now
            </span>
          </div>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 items-baseline">
            <dt className="text-[10px] text-textMuted">At expiry</dt>
            <dd className={`font-mono text-[11px] font-semibold tnum text-right ${pt.expiry > 0 ? 'text-bull' : pt.expiry < 0 ? 'text-bear' : 'text-textPrimary'}`}>{fmtPnl(pt.expiry)}</dd>
            <dt className="text-[10px] text-textMuted">Today</dt>
            <dd className={`font-mono text-[11px] tnum text-right ${pt.now > 0 ? 'text-bull' : pt.now < 0 ? 'text-bear' : 'text-textPrimary'}`}>{fmtPnl(pt.now)}</dd>
          </dl>
          <p className="mt-1.5 pt-1.5 border-t border-ink/[0.06] text-[10px] leading-snug text-textSecondary whitespace-nowrap">
            {words.dealers}
            <br />
            <span className={words.withYou ? 'text-bull' : 'text-bear'}>{words.withYou ? 'with you' : 'against you'}</span>
            <span className="text-textMuted"> · {words.where}</span>
          </p>
        </div>
      )}
    </div>
  );
};

// ---- the card ----------------------------------------------------------------------

interface PositionCardProps {
  position: Position;
  read: PositionRead;
  spot: number;
  levels: ExposureLevels;
  /** The Map's price window — the sketch's range */
  lo: number;
  hi: number;
  focused: boolean;
  onShow: (strike: number) => void;
}

const PositionCard = ({ position: p, read, spot, levels, lo, hi, focused, onShow }: PositionCardProps) => {
  const curve = buildPositionCurve(p, spot, lo, hi);
  const v = VERDICT[read.verdict];
  const title = `${p.contracts} × ${p.ticker} ${fmtStrike(p.strike)} ${p.right === 'C' ? 'call' : 'put'}${p.contracts === 1 ? '' : 's'}`;
  const cost = curve.refIsEntry ? `paid ${curve.ref.toFixed(2)} each` : `worth ${curve.valueNow.toFixed(2)} each today`;
  const wantsUp = (p.right === 'C') === (p.side === 'long');
  const facts: { k: string; v: string; tone?: string }[] = [
    { k: 'Where it sits', v: read.sits },
    { k: 'Breakeven at expiry', v: fmtStrike(Math.round(curve.breakeven * 100) / 100) },
    { k: curve.refIsEntry ? 'If it expired here' : 'If it expired here, vs today', v: fmtPnl(curve.atSpot), tone: curve.atSpot > 0 ? 'text-bull' : curve.atSpot < 0 ? 'text-bear' : undefined },
    { k: 'Dealer gamma at your strike', v: read.gammaHere === 0 ? 'outside the window' : `${fmtUsd(read.gammaHere)}${read.through ? ` · ${read.through === 'slows it' ? 'slows a move' : 'speeds a move up'}` : ''}` },
    { k: 'Expires', v: `${fmtDate(p.expiry)} · ${read.expires}` },
  ];

  return (
    <article
      data-position-card={p.id}
      className={`rounded-[10px] border bg-chip p-4 flex flex-col gap-3 transition-colors ${focused ? 'border-silver/50' : 'border-borderSubtle hover:border-borderMuted'}`}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-[14px] font-semibold leading-tight text-textPrimary truncate"><TickerText text={title} size={13} /></h4>
          <p className="mt-0.5 text-[11px] text-textMuted truncate">
            {p.side === 'long' ? 'You own' : 'You sold'} · {cost} · {p.source === 'tracker' ? 'from the Tracker' : 'added by you'}
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center h-6 px-2.5 rounded-full border text-[11px] font-medium ${v.cls}`} data-verdict={read.verdict}>
          {v.label}
        </span>
      </header>

      <PayoffSketch curve={curve} spot={spot} levels={levels} strike={p.strike} wantsUp={wantsUp} />

      <dl className="grid grid-cols-5 gap-x-4 gap-y-1 border-t border-borderSubtle/50 pt-3">
        {facts.map(f => (
          <div key={f.k} className="min-w-0">
            <dt className="text-[10px] text-textMuted truncate">{f.k}</dt>
            <dd className={`mt-0.5 font-mono text-[12px] tnum leading-snug ${f.tone ?? 'text-textPrimary'}`}>{f.v}</dd>
          </div>
        ))}
      </dl>

      <p className="text-[12px] leading-relaxed text-textSecondary" data-position-sentence>
        {subjectWords(p)} sit{p.contracts === 1 ? 's' : ''} {read.sits}. {read.hedging[0].toUpperCase()}
        {read.hedging.slice(1)}.
      </p>

      <footer className="flex items-center gap-1 -mb-1 -ml-1">
        <button
          onClick={() => onShow(p.strike)}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium text-textSecondary hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
          title="Show this strike on the map"
        >
          Show on the map <ArrowUpRight className="w-3 h-3" />
        </button>
        <PositionForm
          ticker={p.ticker}
          position={p}
          defaultStrike={p.strike}
          align="start"
          trigger={
            <button className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium text-textSecondary hover:text-textPrimary hover:bg-ink/[0.05] transition-colors" data-edit-position>
              <Pencil className="w-3 h-3" /> Change
            </button>
          }
        />
        <button
          onClick={() => removePosition(p.id)}
          className="ml-auto inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
          title="Remove this position"
          aria-label={`Remove ${title}`}
        >
          <X className="w-3 h-3" /> Remove
        </button>
      </footer>
    </article>
  );
};

export default PositionCard;
