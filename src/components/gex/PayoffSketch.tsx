/*
==================================================
  SLAYER TERMINAL - THE PAYOFF SKETCH
  (components/gex/PayoffSketch.tsx)

  One contract's profit or loss across price, the
  grammar of TradingView's strategy builder and
  Robinhood's holding card (the two references Noah
  kept, 2026-09-05): the hard line at expiry with soft
  green and red fills, the soft line for today — and,
  the thing no builder has, the dealer map's walls and
  flip drawn on the same price axis, so "hedging works
  against you above 507.50" is a line on the curve,
  not a sentence in a cell. The Weigher's position
  card draws it (weigher/PositionDeskCard.tsx).

  THE SKETCH ANSWERS THE CURSOR (Noah: "shouldn't
  the cards have hover effects on the literal
  chart making it breathe"): a hairline follows the
  pointer, a dot on each line, the price under the
  axis, and a small card — the price and how far it
  is from now, profit at expiry and today, and what
  dealers do at that price and where it sits
  against the nearest level. The fills come up a
  shade while the pointer is on the chart.

  THE COLOURWAY IS DELIBERATELY QUIET: one neutral
  ground, the house silver for today's line and the
  spot, green and red only for profit and loss, the
  levels as hairlines. Nothing else wears colour.
==================================================
*/

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { fmtPnl, type PositionCurve } from '../../data/positionCurve';
import type { ExposureLevels } from '../../types/gex';
import { FONT_SANS } from '../../theme/fonts';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const GREEN = 'rgb(var(--bull))';
const RED = 'rgb(var(--bear))';
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

// ---- the sketch ----------------------------------------------------------------

const W = 600;
const H = 176;
/* Two rows of level labels fit in the top margin — neighbours that would
   collide take turns */
const M = { l: 48, r: 14, t: 30, b: 22 };
const LABEL_ROWS = [11, 22];
/* the figures' voice — Helvetica's digits are tabular (theme/fonts.ts) */
const FIG = FONT_SANS;

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
  /** The levels' words over their hairlines — off on the Weigher's card (Noah, 2026-09-14:
      "delete this put call words, it's just junk on this page"); the hover card still names them */
  labels?: boolean;
  /** The levels' hairlines themselves — off on the Weigher's card too (Noah, later the same day,
      on the wordless dashes beside the market's line and the ruler's: "2 different columns of
      tickers"): the ruler under that chart is the level scale, with the walls named on its ticks */
  levelMarks?: boolean;
  /** THE PINNED PRICE (Robinhood's ruler, 2026-09-14): a click keeps a price — its hairline and
      dots stay when the pointer leaves, the host reads the figures off it; a click on the kept
      price lets it go */
  pinned?: number | null;
  onPin?: (price: number | null) => void;
  /** What the soft line is — "today", or the scrubbed day's name */
  softLabel?: string;
  /** THE MODEL'S OWN DISTRIBUTION at expiry (the ideas report's Weigher shading, 2026-10-09): the contract's implied vol
      and its time to the bell in years. Given, a quiet bell under the curve shows where the model puts the price at
      expiry, and the hover card says the chance it finishes above or below the price under the pointer. */
  dist?: { iv: number; years: number };
}

/* The standard normal's CDF (Abramowitz–Stegun 7.1.26 through erf) — enough for a chance printed to a whole percent */
const normCdf = (z: number): number => {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
};
/** The chance the price finishes above `k` at expiry, under the lognormal the contract's IV implies (no drift) */
export const chanceAbove = (spot: number, k: number, iv: number, years: number): number => {
  const s = iv * Math.sqrt(Math.max(years, 1e-6));
  if (!(s > 0) || !(k > 0)) return k < spot ? 1 : 0;
  return normCdf((Math.log(spot / k) - (s * s) / 2) / s);
};

/** EXPORTED (2026-09-14): the Weigher's position card draws the same sketch for a watched contract */
export const PayoffSketch = ({ curve, spot, levels, strike, wantsUp, labels = true, levelMarks = true, pinned = null, onPin, softLabel, dist }: SketchProps) => {
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
  /* each label takes the first row where nothing placed before it sits within 90 units —
     three levels a point apart (a tight sim window, 2026-09-14) used to put the two walls
     on the same row with the flip between them */
  for (let i = 1; i < levelLines.length; i++) {
    const near = (row: number) => levelLines.slice(0, i).some(l => l.row === row && x(levelLines[i].price) - x(l.price) < 90);
    levelLines[i].row = near(0) ? 1 : 0;
  }
  const yTicks = [vMax - pad, 0, vMin + pad];
  const pt = hover != null ? points[hover] : null;
  /* A point on both lines AT a price, read between the two samples around it — the pinned price
     is the ruler's, set by the cent, and the nearest sample printed 134.92 under a ruler at
     134.95 (Noah, 2026-09-14); the market's dot reads the same way */
  const at = (price: number): (typeof points)[number] => {
    const last = points[points.length - 1];
    if (price <= points[0].price) return points[0];
    if (price >= last.price) return last;
    let i = 1;
    while (i < points.length - 1 && points[i].price < price) i++;
    const a = points[i - 1];
    const b = points[i];
    const t = b.price === a.price ? 0 : (price - a.price) / (b.price - a.price);
    return { ...a, price, now: a.now + (b.now - a.now) * t, expiry: a.expiry + (b.expiry - a.expiry) * t };
  };
  const pinPt = pinned != null ? at(pinned) : null;
  /* Price ticks, minus any that would print under the "now" label, the cursor's or the kept price's */
  const xTicks = [lo, lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.75, hi].filter(v => Math.abs(x(v) - x(spot)) > 48 && (!pt || Math.abs(x(v) - x(pt.price)) > 48) && (!pinPt || Math.abs(x(v) - x(pinPt.price)) > 48));
  const spotNow = at(spot);

  /* The cursor → the nearest sampled price */
  const indexAt = (e: ReactPointerEvent<SVGSVGElement>): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const u = ((e.clientX - r.left) / r.width) * W;
    const t = Math.max(0, Math.min(1, (u - M.l) / iw));
    return Math.round(t * (points.length - 1));
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const i = indexAt(e);
    if (i != null) setHover(i);
  };
  /* a click keeps the price under the pointer; a click on the kept one lets it go */
  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const i = indexAt(e);
    if (i == null) return;
    setHover(i);
    if (!onPin) return;
    const price = points[i].price;
    onPin(pinned != null && Math.abs(pinned - price) < 1e-9 ? null : price);
  };

  const words = pt ? priceWords(pt.price, levels, wantsUp) : null;
  /* THE BELL: the lognormal's density across the window, its tallest point a third of the plot, drawn from the floor —
     one path, rebuilt with the curve (the window or the vol moved), never animated */
  const bell = (() => {
    if (!dist) return null;
    const s = dist.iv * Math.sqrt(Math.max(dist.years, 1e-6));
    if (!(s > 0)) return null;
    const pdf = (k: number) => (k > 0 ? Math.exp(-((Math.log(k / spot) + (s * s) / 2) ** 2) / (2 * s * s)) / k : 0);
    const N = 96;
    const xs = Array.from({ length: N + 1 }, (_, i) => lo + ((hi - lo) * i) / N);
    const ds = xs.map(pdf);
    const top = Math.max(...ds, 1e-12);
    const floorY = H - M.b;
    const yOf = (d: number) => floorY - (d / top) * ih * 0.34;
    const line = xs.map((k, i) => `${i ? 'L' : 'M'}${x(k).toFixed(1)},${yOf(ds[i]).toFixed(1)}`).join(' ');
    const fill = `${line} L${x(hi).toFixed(1)},${floorY} L${x(lo).toFixed(1)},${floorY} Z`;
    return { line, fill, floorY };
  })();
  const chance = pt && dist ? chanceAbove(spot, pt.price, dist.iv, dist.years) : null;
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
        onPointerDown={onDown}
      >
        <defs>
          <clipPath id={`${clipId}-up`}>
            <rect x={M.l} y={M.t - 2} width={iw} height={Math.max(0, y0 - M.t + 2)} />
          </clipPath>
          <clipPath id={`${clipId}-down`}>
            <rect x={M.l} y={y0} width={iw} height={Math.max(0, H - M.b - y0 + 2)} />
          </clipPath>
        </defs>
        {/* THE MODEL'S BELL — where it puts the price at expiry; under the pointer, the share above it a shade firmer */}
        {bell && (
          <g data-odds-bell>
            <path d={bell.fill} fill={SILVER} fillOpacity={0.07} />
            {pt && (
              <>
                <clipPath id={`${clipId}-above`}>
                  <rect x={x(pt.price)} y={M.t} width={Math.max(0, W - M.r - x(pt.price))} height={ih} />
                </clipPath>
                <path d={bell.fill} fill={SILVER} fillOpacity={0.12} clipPath={`url(#${clipId}-above)`} />
              </>
            )}
            <path d={bell.line} fill="none" stroke={SILVER} strokeOpacity={0.3} strokeWidth={1} />
          </g>
        )}
        {bell && (
          <text x={M.l} y={M.t - 6} fontSize={8.5} fill="rgb(var(--text-muted))" fontFamily={FIG} data-odds-key>
            shaded: where the contract's own vol puts the price at expiry
          </text>
        )}
        {/* the faint grid and the zero line */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="rgb(var(--ink))" strokeOpacity={v === 0 ? 0.22 : 0.06} strokeWidth={1} />
            <text x={M.l - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill="rgb(var(--text-muted))" fontFamily={FIG}>
              {fmtPnl(v)}
            </text>
          </g>
        ))}
        {/* the fills: green above zero, red below — a shade brighter under the pointer */}
        <path d={area} fill={GREEN} clipPath={`url(#${clipId}-up)`} style={{ fillOpacity: hovering ? 0.22 : 0.14, transition: 'fill-opacity 220ms ease-out' }} />
        <path d={area} fill={RED} clipPath={`url(#${clipId}-down)`} style={{ fillOpacity: hovering ? 0.22 : 0.14, transition: 'fill-opacity 220ms ease-out' }} />
        {/* the dealer levels — hairlines with small words at the top (neither on the Weigher's card) */}
        {levelMarks &&
          levelLines.map(l => (
          <g key={l.label}>
            <line x1={x(l.price)} x2={x(l.price)} y1={labels ? LABEL_ROWS[l.row] + 3 : M.t} y2={H - M.b} stroke="rgb(var(--ink))" strokeOpacity={0.16} strokeWidth={1} strokeDasharray="2 3" />
            {labels && (
              <text x={x(l.price)} y={LABEL_ROWS[l.row]} textAnchor="middle" fontSize={8.5} fill="rgb(var(--text-muted))" fontFamily={FIG} data-level-label>
                {l.label}
              </text>
            )}
          </g>
          ))}
        {/* the soft line — today's, or the scrubbed day's — then the hard line at expiry */}
        <path d={path('now')} fill="none" stroke={SILVER} strokeWidth={1.25} strokeDasharray="3 3" style={{ strokeOpacity: hovering ? 1 : 0.8, transition: 'stroke-opacity 220ms ease-out' }} data-soft-line />
        {softLabel && (
          <text x={W - M.r} y={M.t - 6} textAnchor="end" fontSize={8.5} fill={SILVER} fontFamily={FIG} data-soft-label>
            ┄ {softLabel}
          </text>
        )}
        <path d={path('expiry')} fill="none" stroke={GREEN} strokeWidth={1.5} clipPath={`url(#${clipId}-up)`} />
        <path d={path('expiry')} fill="none" stroke={RED} strokeWidth={1.5} clipPath={`url(#${clipId}-down)`} />
        {/* your strike — a small tick on the zero line */}
        <path d={`M${x(strike)},${y0 + 5} l-4,6 h8 z`} fill="rgb(var(--text-primary))" fillOpacity={0.7} />
        {/* now — the spot, on today's line */}
        <line x1={x(spot)} x2={x(spot)} y1={M.t} y2={H - M.b} stroke={SILVER} strokeOpacity={0.35} strokeWidth={1} />
        <circle cx={x(spot)} cy={y(spotNow.now)} r={3} fill={SILVER} stroke="rgb(var(--panel))" strokeWidth={1.5} />
        {/* the price axis */}
        {xTicks.map(v => (
          <text key={v} x={x(v)} y={H - 6} textAnchor={v === lo ? 'start' : v === hi ? 'end' : 'middle'} fontSize={9} fill="rgb(var(--text-muted))" fontFamily={FIG} data-x-tick>
            {fmtStrike(Math.round(v * 2) / 2)}
          </text>
        ))}
        <text x={x(spot)} y={H - 6} textAnchor="middle" fontSize={9} fontWeight={600} fill={SILVER} fontFamily={FIG} data-now-label style={{ paintOrder: 'stroke', stroke: 'rgb(var(--panel))', strokeWidth: 4 }}>
          now {spot.toFixed(2)}
        </text>
        {/* THE PINNED PRICE — kept when the pointer leaves: a silver hairline, the dots, its price under the axis */}
        {pinPt && (!pt || Math.abs(pt.price - pinPt.price) > 1e-9) && (
          <g data-pin>
            <line x1={x(pinPt.price)} x2={x(pinPt.price)} y1={M.t} y2={H - M.b} stroke={SILVER} strokeOpacity={0.6} strokeWidth={1} />
            <circle cx={x(pinPt.price)} cy={y(pinPt.now)} r={3} fill="rgb(var(--panel))" stroke={SILVER} strokeWidth={1.5} />
            <circle cx={x(pinPt.price)} cy={y(pinPt.expiry)} r={3.5} fill={pinPt.expiry >= 0 ? GREEN : RED} stroke="rgb(var(--panel))" strokeWidth={1.5} />
            {Math.abs(x(pinPt.price) - x(spot)) > 48 && (
              <text x={x(pinPt.price)} y={H - 6} textAnchor="middle" fontSize={9} fontWeight={600} fill={SILVER} fontFamily={FIG} style={{ paintOrder: 'stroke', stroke: 'rgb(var(--panel))', strokeWidth: 4 }}>
                {pinPt.price.toFixed(2)}
              </text>
            )}
          </g>
        )}
        {/* THE CURSOR — a hairline, a dot on each line, the price under the axis */}
        {pt && (
          <g data-cursor>
            <line x1={x(pt.price)} x2={x(pt.price)} y1={M.t} y2={H - M.b} stroke="rgb(var(--ink))" strokeOpacity={0.35} strokeWidth={1} />
            <circle cx={x(pt.price)} cy={y(pt.now)} r={3} fill="rgb(var(--panel))" stroke={SILVER} strokeWidth={1.5} />
            <circle cx={x(pt.price)} cy={y(pt.expiry)} r={3.5} fill={pt.expiry >= 0 ? GREEN : RED} stroke="rgb(var(--panel))" strokeWidth={1.5} />
            {Math.abs(x(pt.price) - x(spot)) > 48 && (
              <text x={x(pt.price)} y={H - 6} textAnchor="middle" fontSize={9} fontWeight={600} fill="rgb(var(--text-primary))" fontFamily={FIG} style={{ paintOrder: 'stroke', stroke: 'rgb(var(--panel))', strokeWidth: 4 }}>
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
            <span className="font-mono text-[11px] tnum text-textMuted">
              {pt.price >= spot ? '+' : ''}
              {(((pt.price - spot) / spot) * 100).toFixed(2)}% from now
            </span>
          </div>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 items-baseline">
            <dt className="text-[11px] text-textMuted">At expiry</dt>
            <dd className={`font-mono text-[11px] font-semibold tnum text-right ${pt.expiry > 0 ? 'text-bull' : pt.expiry < 0 ? 'text-bear' : 'text-textPrimary'}`}>{fmtPnl(pt.expiry)}</dd>
            <dt className="text-[11px] text-textMuted">Today</dt>
            <dd className={`font-mono text-[11px] tnum text-right ${pt.now > 0 ? 'text-bull' : pt.now < 0 ? 'text-bear' : 'text-textPrimary'}`}>{fmtPnl(pt.now)}</dd>
          </dl>
          {chance != null && (
            /* a chance, said as one — never a "win rate" */
            <p className="mt-1.5 pt-1.5 border-t border-ink/[0.06] text-[11px] leading-snug text-textSecondary" data-odds-read>
              Chance it finishes above at expiry <span className="font-mono tnum text-textPrimary">{Math.round(chance * 100)}%</span>
              <br />
              below <span className="font-mono tnum text-textPrimary">{Math.round((1 - chance) * 100)}%</span>
              <span className="text-textMuted"> · from the contract's own vol</span>
            </p>
          )}
          <p className="mt-1.5 pt-1.5 border-t border-ink/[0.06] text-[11px] leading-snug text-textSecondary whitespace-nowrap">
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

