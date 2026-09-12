import { ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BULL, PUT_WALL, FLIP, SPOT } from '../palette';
import { AXIS_TICK, AwaitingState, CURSOR_INK, GRID_INK, LegendKey, TipCard, TipRow, fiveTicks, timeTick } from '../driftKit';
import type { WallDriftPoint } from '../../../types/gex';

/*
  Session timeline of the walls, flip and spot — proof the levels move.
  Wall Drift's grammar, drawn by recharts on the shared kit (driftKit.tsx);
  the inks, the DOM legend and the hover card are the house's own.
*/

interface WallDriftProps {
  drift: WallDriftPoint[];
}

const SERIES: { key: keyof WallDriftPoint & string; label: string; color: string; dash?: string; width: number }[] = [
  { key: 'callWall', label: 'Call wall', color: BULL, width: 1.4 },
  { key: 'putWall', label: 'Put wall', color: PUT_WALL, width: 1.4 },
  { key: 'flip', label: 'Flip', color: FLIP, dash: '4 3', width: 1.6 },
  { key: 'spot', label: 'Spot', color: SPOT, width: 2 },
];

interface TipProps {
  active?: boolean;
  payload?: { payload?: WallDriftPoint }[];
}

const WallTip = ({ active, payload }: TipProps) => {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  /* Rows ordered the way the lines stack at this moment. */
  const rows = SERIES.map(s => ({ ...s, v: p[s.key] as number })).sort((a, b) => b.v - a.v);
  return (
    <TipCard title={timeTick(p.time)}>
      {rows.map(r => (
        <TipRow key={r.label} ink={r.color} label={r.label} value={r.v.toFixed(2)} />
      ))}
    </TipCard>
  );
};

const WallDrift = ({ drift }: WallDriftProps) => {
  if (drift.length < 2) {
    return <AwaitingState>Awaiting session history…</AwaitingState>;
  }

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex items-center gap-3 flex-wrap select-none">
        {SERIES.map(s => (
          <LegendKey key={s.label} ink={s.color} dash={!!s.dash}>
            {s.label}
          </LegendKey>
        ))}
      </div>

      <div className="flex-grow min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={drift} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_INK} vertical={false} />
            <XAxis
              dataKey="time"
              ticks={fiveTicks(drift.map(p => p.time))}
              tickFormatter={timeTick}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              height={16}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={AXIS_TICK}
              tickFormatter={(v: number) => v.toFixed(0)}
              tickLine={false}
              axisLine={false}
              width={38}
              tickCount={4}
            />
            <Tooltip content={<WallTip />} isAnimationActive={false} cursor={{ stroke: CURSOR_INK, strokeWidth: 1 }} />
            {SERIES.map(s => (
              <Line
                key={s.key}
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                strokeOpacity={s.key === 'spot' ? 0.9 : 0.85}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 1, stroke: '#0c0c0c' }}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WallDrift;
