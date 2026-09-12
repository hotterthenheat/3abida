import { useId } from 'react';
import { ComposedChart, CartesianGrid, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FLIP, LONG_GAMMA, SHORT_GAMMA, SPOT } from '../palette';
import { fmtUsd } from '../../../data/gex';
import { AXIS_TICK, AwaitingState, CURSOR_INK, GRID_INK, LegendKey, TipCard, TipRow, fiveTicks, timeTick } from '../driftKit';
import type { NetGexSeries, NetGexPoint } from '../../../data/gexSeries';

/*
==================================================
  SLAYER TERMINAL - NET GEX TIMELINE — P-3
  (components/gex/vannacharm/NetGexDrift.tsx)
==================================================

  Wall Drift's sibling, answering the other half of its question. The drift
  shows where the LEVELS moved through the session; this shows whether the
  gamma behind them GREW or DRAINED — and those are different facts: walls can
  hold position all day while the book behind them empties, which is a pin
  turning into a trend with nothing moving on the drift at all.

  WALL DRIFT'S GRAMMAR THROUGHOUT — the shared kit, the same card — because
  the two sit stacked on one page reading the same session, and a reader
  moving between them should not have to learn a second chart.

  THE LINE WEARS THE REGIME'S OWN INKS: red while the total is positive
  (put-dominant, dealers short, amplifying) and green while negative — the
  pair Noah fixed for exactly this number (palette.ts). Drawn as ONE line
  under a vertical gradient with a hard stop at zero, which is the same
  statement the old sign-run segments made ("above the zero line = short
  gamma") with the crossing pixel exact instead of snapped to a sample. The
  ZERO LINE is the flip's blue: crossing it is the WHOLE BOOK changing sign
  — and each crossing is marked ON it. Spot rides along in white on its own
  hidden scale, so "the book drained WHILE price climbed" is one glance;
  its numbers live in the hover card, never on an axis.
*/

interface NetGexDriftProps {
  series: NetGexSeries;
}

interface TipProps {
  active?: boolean;
  payload?: { payload?: NetGexPoint }[];
}

const NetTip = ({ active, payload }: TipProps) => {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const ink = p.netGex >= 0 ? SHORT_GAMMA : LONG_GAMMA;
  return (
    <TipCard title={timeTick(p.time)}>
      <TipRow
        ink={ink}
        label={p.netGex >= 0 ? 'amplifying' : 'absorbing'}
        value={fmtUsd(p.netGex)}
        valueInk={ink}
      />
      <TipRow ink={SPOT} label="Spot" value={p.spot.toFixed(2)} />
    </TipCard>
  );
};

const NetGexDrift = ({ series }: NetGexDriftProps) => {
  const gradId = useId().replace(/[:]/g, '');
  const { points, zeroCrossings } = series;

  if (points.length < 2) {
    return <AwaitingState>Awaiting session history…</AwaitingState>;
  }

  /* The gamma scale MUST hold zero — the whole point is which side of it the
     session ran — so the domain is forced to include it. The gradient's hard
     stop sits where zero falls inside that domain, so the ink changes side
     exactly at the line it is about. */
  const pad = (series.max - series.min) * 0.08 || 1;
  const gMin = Math.min(series.min, 0) - pad;
  const gMax = Math.max(series.max, 0) + pad;
  const zeroOffset = Math.min(1, Math.max(0, gMax / (gMax - gMin)));

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex items-center gap-3 flex-wrap select-none">
        <LegendKey ink={SHORT_GAMMA}>Net GEX +</LegendKey>
        <LegendKey ink={LONG_GAMMA}>Net GEX −</LegendKey>
        <LegendKey ink={FLIP} dash>
          Zero — the book flips
        </LegendKey>
        <LegendKey ink={SPOT}>Spot</LegendKey>
        {zeroCrossings.length > 0 && (
          <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-textMuted tnum">
            flipped {zeroCrossings.length}× today
          </span>
        )}
      </div>

      <div className="flex-grow min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points as NetGexPoint[]} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={SHORT_GAMMA} />
                <stop offset={zeroOffset} stopColor={SHORT_GAMMA} />
                <stop offset={zeroOffset} stopColor={LONG_GAMMA} />
                <stop offset="1" stopColor={LONG_GAMMA} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_INK} vertical={false} />
            <XAxis
              dataKey="time"
              ticks={fiveTicks(points.map(p => p.time))}
              tickFormatter={timeTick}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              height={16}
            />
            <YAxis
              yAxisId="gex"
              domain={[gMin, gMax]}
              /* Zero is a labelled tick, always — it is the line the whole
                 chart is about. The ends stay exact rather than niced, so
                 the extremes read at a glance too. */
              ticks={[gMin, gMin / 2, 0, gMax / 2, gMax].filter((v, i, a) => a.indexOf(v) === i)}
              tick={AXIS_TICK}
              tickFormatter={(v: number) => (v === 0 ? '0' : fmtUsd(v))}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            {/* Spot is context, not the subject — thin, unlabelled, its own
                hidden scale; its numbers live in the hover card. */}
            <YAxis yAxisId="spot" domain={['auto', 'auto']} hide />
            <Tooltip content={<NetTip />} isAnimationActive={false} cursor={{ stroke: CURSOR_INK, strokeWidth: 1 }} />
            <ReferenceLine yAxisId="gex" y={0} stroke={FLIP} strokeOpacity={0.55} strokeDasharray="4 3" />
            <Line
              yAxisId="spot"
              dataKey="spot"
              stroke={SPOT}
              strokeWidth={1.2}
              strokeOpacity={0.5}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="gex"
              dataKey="netGex"
              stroke={`url(#${gradId})`}
              strokeWidth={1.8}
              strokeOpacity={0.9}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 1, stroke: '#0c0c0c' }}
              isAnimationActive={false}
            />
            {/* The book's own flips, marked ON the zero line where they happened. */}
            {zeroCrossings.map(i => (
              <ReferenceDot
                key={points[i].time}
                yAxisId="gex"
                x={points[i].time}
                y={0}
                r={2.5}
                fill={FLIP}
                fillOpacity={0.9}
                stroke="none"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default NetGexDrift;
