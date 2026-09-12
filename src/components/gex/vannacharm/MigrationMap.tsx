import { Fragment, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Simulator from '../../../core/simulator';
import { fmtUsd } from '../../../data/gex';
import { heatRgb } from '../heatmap';
import SignalBadge from '../../ui/SignalBadge';
import TrendLine from '../TrendLine';
import type { ShiftBarRow, VannaCharmView } from '../../../types/gex';

interface MigrationMapProps {
  data: VannaCharmView;
}

/**
 * Center-out bar that glides between scans / scenario switches.
 * Projection is a dimmer SOLID — opacity contrast survives 4px bars, outlines don't.
 */
const Bar = ({ value, max, top, ghost }: { value: number; max: number; top: boolean; ghost: boolean }) => {
  const pct = Math.min(48, (Math.abs(value) / (max || 1)) * 48);
  const neg = value < 0;
  const [r, g, b] = heatRgb(value, max);
  return (
    <motion.span
      className={`absolute ${top ? 'top-[2px]' : 'bottom-[2px]'} h-[4px] rounded-sm`}
      initial={false}
      animate={{ left: `${neg ? 50 - pct : 50}%`, width: `${pct}%`, opacity: pct < 0.5 ? 0 : 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: `rgba(${r},${g},${b},${ghost ? 0.35 : 0.95})` }}
    />
  );
};

/** Hover readout: now → projected for the strike, with real history behind it. */
const ShiftHoverCard = ({
  row,
  data,
  y,
}: {
  row: ShiftBarRow;
  data: VannaCharmView;
  y: number;
}) => {
  const series = useMemo(() => {
    const snaps = Simulator.getGexHistory(data.ticker) ?? [];
    const out: number[] = [];
    for (let i = Math.max(0, snaps.length - 16); i < snaps.length; i++) {
      const lvl = snaps[i].levels.find(l => l.strike === row.strike);
      if (lvl) out.push(lvl.value);
    }
    return out;
  }, [data.ticker, row.strike]);

  const delta = row.projected - row.current;
  const pct = row.current !== 0 ? (delta / Math.abs(row.current)) * 100 : 0;
  const up = delta >= 0;
  const strikeLabel = row.strike % 1 === 0 ? row.strike.toFixed(0) : row.strike.toFixed(2);
  const scenario = data.mode === 'CHARM' ? 'CHARM → CLOSE' : `VANNA ${data.ivShift > 0 ? '+' : ''}${data.ivShift} IV`;

  return (
    <div
      className={`absolute z-20 w-60 pointer-events-none border border-borderSubtle bg-chip/95 rounded-md shadow-lg p-3 animate-soft-in ${
        row.current >= 0 ? 'left-16' : 'right-4'
      }`}
      style={{ top: Math.max(4, y - 90) }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-textPrimary tnum">
          Strike {strikeLabel}
          {row.pin && <span className="ml-1.5 font-mono text-[8px] font-bold uppercase tracking-wider text-textSecondary">pin</span>}
        </span>
        <SignalBadge tone="neutral">{scenario}</SignalBadge>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <div className="font-mono text-[8px] uppercase tracking-widest text-textMuted">Now</div>
          <div className={`font-mono text-sm font-bold tnum ${row.current >= 0 ? 'text-bull' : 'text-bear'}`}>
            {row.current >= 0 ? '+' : ''}
            {fmtUsd(row.current)}
          </div>
        </div>
        <div>
          <div className="font-mono text-[8px] uppercase tracking-widest text-textMuted">Projected</div>
          <div className={`font-mono text-sm font-bold tnum ${row.projected >= 0 ? 'text-bull' : 'text-bear'}`}>
            {row.projected >= 0 ? '+' : ''}
            {fmtUsd(row.projected)}
          </div>
        </div>
      </div>

      <div className={`mt-1 font-mono text-[10px] tnum font-semibold ${up ? 'text-bull' : 'text-bear'}`}>
        {up ? '↗' : '↘'} {up ? '+' : '−'}
        {fmtUsd(Math.abs(delta))} ({up ? '+' : '−'}
        {Math.abs(pct).toFixed(1)}%) under {data.mode === 'CHARM' ? 'charm decay' : 'the vol shift'}
      </div>

      {series.length > 1 && (
        <div className="mt-2 pt-2 border-t border-borderSubtle/60">
          <div className="font-mono text-[8px] uppercase tracking-widest text-textMuted mb-1">Value over time</div>
          <TrendLine points={series} />
          <div className="flex justify-between font-mono text-[8px] text-textMuted">
            <span>15m ago</span>
            <span>now</span>
          </div>
        </div>
      )}
    </div>
  );
};

const FlipMark = ({ price, projected }: { price: number; projected?: boolean }) => (
  <div className="flex items-center gap-1.5 px-2 py-[2px]">
    <span className={`h-0 flex-grow border-t border-dashed ${projected ? 'border-flip/35' : 'border-flip/70'}`} />
    <span
      className={`inline-flex items-center rounded-[3px] border bg-canvas px-1.5 py-px font-mono text-[8px] font-bold uppercase tracking-wider whitespace-nowrap ${
        projected ? 'border-flip/40 text-flip/70' : 'border-flip/60 text-flip'
      }`}
    >
      {projected ? '→ FLIP' : 'FLIP'} {price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}
    </span>
    <span className={`h-0 w-3 shrink-0 border-t border-dashed ${projected ? 'border-flip/35' : 'border-flip/70'}`} />
  </div>
);

/**
 * Current vs projected net GEX per strike: solid bar = now, outlined ghost =
 * under the scenario. Both flips are marked so the regime-border move is the
 * first thing you see.
 */
const MigrationMap = ({ data }: MigrationMapProps) => {
  const { ticker, rows, maxAbs, flipCurrent, flipProjected } = data;

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [hoverRow, setHoverRow] = useState<ShiftBarRow | null>(null);
  const [hoverY, setHoverY] = useState(0);

  const slotAfter = (level: number) => {
    let idx = rows.findIndex((row, i) => row.strike >= level && (rows[i + 1]?.strike ?? -Infinity) < level);
    if (idx === -1) idx = level > (rows[0]?.strike ?? 0) ? -0.5 : rows.length - 1;
    return idx;
  };
  const flipAfter = slotAfter(flipCurrent);
  const flipProjAfter = flipProjected !== flipCurrent ? slotAfter(flipProjected) : -2;

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Legend */}
      <div className="flex items-center gap-3 px-2 py-1.5 border-b border-borderSubtle flex-wrap select-none">
        {[
          { label: 'Current', cls: 'bg-ink/80' },
          { label: 'Projected', cls: 'bg-ink/30' },
        ].map(item => (
          <span key={item.label} className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-textSecondary">
            <span className={`inline-block w-2.5 h-[5px] rounded-[2px] ${item.cls}`} />
            {item.label}
          </span>
        ))}
        <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-textMuted">{ticker} · net GEX</span>
      </div>

      {/* Rows */}
      <div
        ref={bodyRef}
        className="flex-grow overflow-y-auto min-h-0"
        onMouseMove={e => {
          const rect = bodyRef.current?.getBoundingClientRect();
          if (rect) setHoverY(e.clientY - rect.top + (bodyRef.current?.offsetTop ?? 0));
        }}
        onMouseLeave={() => setHoverRow(null)}
      >
        {flipAfter === -0.5 && <FlipMark price={flipCurrent} />}
        {flipProjAfter === -0.5 && <FlipMark price={flipProjected} projected />}
        {rows.map((row, i) => (
          <Fragment key={row.strike}>
            <div
              onMouseEnter={() => setHoverRow(row)}
              className={`flex items-center border-b border-borderSubtle/20 ${row.pin ? 'bg-ink/[0.03]' : ''} ${
                hoverRow?.strike === row.strike ? 'bg-ink/[0.04]' : ''
              }`}
            >
              <span className="w-14 shrink-0 px-2 py-[4px] bg-inset border-r border-borderSubtle/40 font-mono text-[10px] font-semibold tnum text-textSecondary">
                {row.strike % 1 === 0 ? row.strike.toFixed(0) : row.strike.toFixed(2)}
                {row.pin && <span className="ml-1 font-mono text-[7px] font-bold uppercase text-textPrimary">pin</span>}
              </span>
              <div className="relative flex-1 h-[15px]">
                <span className="absolute left-1/4 top-0 bottom-0 w-px bg-ink/[0.04]" />
                <span className="absolute left-3/4 top-0 bottom-0 w-px bg-ink/[0.04]" />
                <span className="absolute left-1/2 top-0 bottom-0 w-px bg-borderMuted" />
                <Bar value={row.current} max={maxAbs} top ghost={false} />
                <Bar value={row.projected} max={maxAbs} top={false} ghost />
              </div>
            </div>
            {i === flipAfter && <FlipMark price={flipCurrent} />}
            {i === flipProjAfter && <FlipMark price={flipProjected} projected />}
          </Fragment>
        ))}
      </div>

      {/* Hover readout — opposite side of the bar, clear of the cursor */}
      {hoverRow && <ShiftHoverCard row={hoverRow} data={data} y={hoverY} />}

      <div className="px-2.5 py-1.5 border-t border-borderSubtle font-mono text-[9px] text-textMuted leading-relaxed select-none">
        Bright = positioning now · Dim = after {data.mode === 'CHARM' ? 'charm decay into the close' : `an IV ${data.ivShift > 0 ? '+' : ''}${data.ivShift} vol move`}
      </div>
    </div>
  );
};

export default MigrationMap;
