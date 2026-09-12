import { Fragment } from 'react';
import { fmtUsd } from '../../data/gex';
import SpotRule from '../ui/SpotRule';
import { heatRgb } from './heatmap';
import type { PressureRow, PressureSide } from '../../types/gex';

interface PressureMatrixProps {
  ticker: string;
  spot: number;
  rows: PressureRow[];
  maxAbs: number;
  /** Click a strike to flash it on the chart */
  onSelectStrike?: (strike: number) => void;
}

const SideCells = ({ side, significantAbs }: { side: PressureSide; significantAbs: number }) => {
  const dOiUp = side.deltaOI >= 0;
  // Color only the deltas that matter — forty red/green arrows is noise, a handful is signal.
  const significant = significantAbs > 0 && Math.abs(side.deltaOI) >= significantAbs;
  return (
    <>
      <td className="px-2 py-1 text-right font-mono text-[11px] tnum text-textPrimary border-l border-borderSubtle/40">
        {fmtUsd(side.pressure)}
      </td>
      <td
        className={`px-1.5 py-1 text-right font-mono text-[9px] tnum ${
          significant ? (dOiUp ? 'text-bull font-semibold' : 'text-bear font-semibold') : 'text-textSecondary'
        }`}
      >
        {dOiUp ? '↑' : '↓'}{Math.abs(side.deltaOI).toLocaleString()}
      </td>
      <td className="px-1.5 py-1 text-right font-mono text-[9px] tnum text-textMuted">
        {side.volume.toLocaleString()}
      </td>
    </>
  );
};

/**
 * Strike × dealer pressure: calls and puts each show pressure / ΔOI / volume,
 * net pressure carries the pastel heat bar. Pin and flip strikes are flagged
 * in the rail; the spot rule embeds between rows.
 */
const PressureMatrix = ({ ticker, spot, rows, maxAbs, onSelectStrike }: PressureMatrixProps) => {
  let spotAfterIndex = rows.findIndex((r, i) => r.strike >= spot && (rows[i + 1]?.strike ?? -Infinity) < spot);
  if (spotAfterIndex === -1) spotAfterIndex = spot > (rows[0]?.strike ?? 0) ? -0.5 : rows.length - 1;

  // ΔOI significance = top quintile by magnitude across both sides of the book.
  const deltas = rows.flatMap(r => [Math.abs(r.call.deltaOI), Math.abs(r.put.deltaOI)]).sort((a, b) => a - b);
  const significantAbs = deltas.length ? deltas[Math.floor(deltas.length * 0.8)] : 0;

  return (
    <div className="overflow-auto h-full min-h-0">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-chip">
            <th className="px-2 py-1.5 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-textSecondary border-b border-borderSubtle">
              Strike
            </th>
            <th colSpan={3} className="px-2 py-1.5 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-bull border-b border-l border-borderSubtle">
              Calls
            </th>
            <th colSpan={3} className="px-2 py-1.5 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-bear border-b border-l border-borderSubtle">
              Puts
            </th>
            <th className="px-2 py-1.5 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-textPrimary border-b border-l border-borderSubtle">
              Net
            </th>
          </tr>
          <tr className="bg-chip">
            <th className="border-b border-borderSubtle" />
            {(['Pressure', 'ΔOI', 'Vol', 'Pressure', 'ΔOI', 'Vol'] as const).map((label, i) => (
              <th
                key={`${label}-${i}`}
                className={`px-1.5 py-1 text-right font-mono text-[9px] font-semibold uppercase tracking-widest text-textSecondary border-b border-borderSubtle ${
                  i % 3 === 0 ? 'border-l' : ''
                }`}
              >
                {label}
              </th>
            ))}
            <th className="border-b border-l border-borderSubtle" />
          </tr>
        </thead>
        <tbody>
          {spotAfterIndex === -0.5 && (
            <tr>
              <td colSpan={8} className="px-2 py-1">
                <SpotRule ticker={ticker} price={spot} />
              </td>
            </tr>
          )}
          {rows.map((row, i) => {
            const [r, g, b] = heatRgb(row.net, maxAbs);
            const netPct = Math.min(100, (Math.abs(row.net) / (maxAbs || 1)) * 100);
            return (
              <Fragment key={row.strike}>
                <tr
                  onClick={onSelectStrike ? () => onSelectStrike(row.strike) : undefined}
                  title={onSelectStrike ? 'Flash on chart' : undefined}
                  className={`border-b border-borderSubtle/30 transition-colors ${row.pin ? 'bg-ink/[0.03]' : ''} ${
                    onSelectStrike ? 'cursor-pointer hover:bg-ink/[0.04]' : ''
                  }`}
                >
                  <td className="px-2 py-1 bg-inset border-r border-borderSubtle/40 font-mono text-[10px] font-semibold tnum text-textSecondary whitespace-nowrap">
                    {row.strike % 1 === 0 ? row.strike.toFixed(0) : row.strike.toFixed(2)}
                    {row.pin && (
                      <span className="ml-1.5 font-mono text-[8px] font-bold uppercase tracking-wider text-textPrimary">pin</span>
                    )}
                    {row.flip && (
                      <span className="ml-1.5 font-mono text-[8px] font-bold uppercase tracking-wider text-flip">flip</span>
                    )}
                  </td>
                  <SideCells side={row.call} significantAbs={significantAbs} />
                  <SideCells side={row.put} significantAbs={significantAbs} />
                  <td className="px-2 py-1 text-right border-l border-borderSubtle/40">
                    <span className="block font-mono text-[10px] font-semibold tnum text-textPrimary">{fmtUsd(row.net)}</span>
                    <span className="mt-0.5 ml-auto block h-[3px] w-full max-w-[46px] rounded-full bg-ink/[0.04]">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${netPct}%`, background: `rgba(${r},${g},${b},0.9)` }}
                      />
                    </span>
                  </td>
                </tr>
                {i === spotAfterIndex && (
                  <tr>
                    <td colSpan={8} className="px-2 py-1">
                      <SpotRule ticker={ticker} price={spot} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PressureMatrix;
