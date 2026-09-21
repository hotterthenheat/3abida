import { useId, useMemo } from 'react';
import type { PayoffProfile } from '../../core/paper/payoff';

/*
==================================================
  SLAYER TERMINAL - THE PAYOFF CURVE
  (components/ui/PayoffChart.tsx)

  What the strategy makes, at every price, at
  expiry.
==================================================

  ONE SHAPE, TWO FILLS, AND A ZERO LINE. The curve is split at the zero
  crossing rather than drawn once and tinted, because a single-colour payoff
  with a legend is a picture you have to decode; a green region above the
  line and a red one below is a picture you have already read.

  THE ZERO LINE IS THE ONLY GRIDLINE. Every other horizontal rule on a
  payoff chart competes with the one fact the reader came for. The strikes
  mark themselves — they are the kinks — so they get ticks on the axis and
  nothing above it.

  SPOT IS A LINE, NOT A DOT. Where the underlying is NOW is what turns a
  shape into a position: the distance from spot to the nearest breakeven is
  the trade. It gets the brightest rule on the chart.
*/

interface PayoffChartProps {
  profile: PayoffProfile;
  /** Where the underlying is now */
  spot: number;
  /** Strikes to tick on the axis */
  strikes?: number[];
  height?: number;
  className?: string;
  /** Formats an underlying price for the axis */
  fmt?: (v: number) => string;
}

const PayoffChart = ({ profile, spot, strikes = [], height = 150, className = '', fmt }: PayoffChartProps) => {
  const uid = useId().replace(/[:]/g, '');
  const { points } = profile;

  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const W = 1000;
    const H = 300;
    const padL = 6;
    const padR = 6;
    const padT = 14;
    const padB = 14;
    const xs = points.map(p => p.s);
    const ys = points.map(p => p.pnl);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const yMax = Math.max(...ys, 0);
    const yMin = Math.min(...ys, 0);
    /* The zero line must sit inside the frame even when the whole curve is
       one side of it — a payoff drawn entirely above a zero line you cannot
       see is just a rising line. */
    const span = Math.max(yMax - yMin, 1e-6);
    const X = (s: number) => padL + ((s - x0) / Math.max(x1 - x0, 1e-9)) * (W - padL - padR);
    const Y = (v: number) => padT + (1 - (v - yMin) / span) * (H - padT - padB);
    const zeroY = Y(0);
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p.s).toFixed(2)},${Y(p.pnl).toFixed(2)}`).join('');
    const area = `${line}L${X(x1).toFixed(2)},${zeroY.toFixed(2)}L${X(x0).toFixed(2)},${zeroY.toFixed(2)}Z`;
    return { W, H, X, Y, zeroY, line, area, x0, x1, padT, padB };
  }, [points]);

  if (!geo) return null;
  const { W, H, X, zeroY, line, area, x0, x1 } = geo;
  const inRange = (v: number) => v >= x0 && v <= x1;
  const f = fmt ?? ((v: number) => v.toFixed(0));

  return (
    <div className={className} data-payoff-chart>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="Profit and loss at expiry across underlying price">
        <defs>
          {/* Above zero is green, below is red — one clip each, so the curve
              itself is drawn once and the FILL is what carries the meaning */}
          <clipPath id={`up${uid}`}><rect x="0" y="0" width={W} height={zeroY} /></clipPath>
          <clipPath id={`dn${uid}`}><rect x="0" y={zeroY} width={W} height={H - zeroY} /></clipPath>
        </defs>

        <path d={area} fill="rgb(var(--bull) / 0.18)" clipPath={`url(#up${uid})`} />
        <path d={area} fill="rgb(var(--bear) / 0.16)" clipPath={`url(#dn${uid})`} />

        {/* the zero line — the only gridline on the chart */}
        <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="rgb(var(--border-muted))" strokeWidth="1.5" />

        {/* strikes: ticks at the kinks, nothing above the axis */}
        {strikes.filter(inRange).map(k => (
          <line key={k} x1={X(k)} y1={H - 10} x2={X(k)} y2={H} stroke="rgb(var(--text-muted))" strokeWidth="1.5" />
        ))}

        {/* breakevens */}
        {profile.breakevens.filter(inRange).map(be => (
          <line key={be} x1={X(be)} y1="0" x2={X(be)} y2={H} stroke="rgb(var(--text-muted))" strokeWidth="1.5" strokeDasharray="4 5" />
        ))}

        {/* spot — the brightest rule, because the distance to a breakeven is the trade */}
        {inRange(spot) && (
          <line x1={X(spot)} y1="0" x2={X(spot)} y2={H} stroke="rgb(var(--text-primary))" strokeWidth="2" />
        )}

        <path d={line} fill="none" stroke="rgb(var(--bull))" strokeWidth="2.5" clipPath={`url(#up${uid})`} vectorEffect="non-scaling-stroke" />
        <path d={line} fill="none" stroke="rgb(var(--bear))" strokeWidth="2.5" clipPath={`url(#dn${uid})`} vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="flex items-baseline justify-between px-0.5 pt-1">
        <span className="font-mono text-[9px] text-textMuted tnum">{f(x0)}</span>
        <span className="font-mono text-[9px] text-textSecondary tnum">
          {profile.breakevens.length
            ? `breakeven ${profile.breakevens.map(f).join(' · ')}`
            : 'no breakeven in range'}
        </span>
        <span className="font-mono text-[9px] text-textMuted tnum">{f(x1)}</span>
      </div>
    </div>
  );
};

export default PayoffChart;
