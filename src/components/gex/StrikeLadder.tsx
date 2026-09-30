import { fmtUsd } from '../../data/gex';
import SpotRule from '../ui/SpotRule';
import { heatCellStyle } from './heatmap';
import type { BoardTicker } from '../../types/gex';

interface StrikeLadderProps {
  board: BoardTicker;
}

/** Single-ticker GEX ladder column with the live price embedded between strikes. */
const StrikeLadder = ({ board }: StrikeLadderProps) => {
  const { ticker, spot, changePercent, ladder, ladderMaxAbs } = board;
  const up = changePercent >= 0;

  // Ladder is descending — the spot marker sits under the first strike above spot
  let spotAfterIndex = ladder.findIndex((row, i) => row.strike >= spot && (ladder[i + 1]?.strike ?? -Infinity) < spot);
  if (spotAfterIndex === -1) spotAfterIndex = spot > (ladder[0]?.strike ?? 0) ? -0.5 : ladder.length - 1;

  const total = ladder.reduce((a, r) => a + r.value, 0);

  return (
    <div className="border border-borderSubtle bg-panel rounded-md overflow-hidden flex flex-col min-w-0">
      <div className="flex items-center gap-2 px-2.5 h-8 border-b border-borderSubtle shrink-0 select-none">
        <span className="font-mono text-[11px] font-bold text-textPrimary">{ticker}</span>
        <span className={`font-mono text-[10px] tnum ${up ? 'text-bull' : 'text-bear'}`}>
          {up ? '+' : ''}
          {changePercent.toFixed(2)}%
        </span>
        <span className="ml-auto font-mono text-[9px] text-textMuted uppercase tracking-wider">gex</span>
      </div>

      <div className="flex-grow overflow-y-auto">
        {spotAfterIndex === -0.5 && <SpotMarker ticker={ticker} spot={spot} />}
        {ladder.map((row, i) => (
          <div key={row.strike}>
            <div className="flex items-stretch border-b border-borderSubtle/30">
              {/* Strike — its own dark column, un-tinted (mirrors the matrix Strike column) */}
              <span className="w-14 shrink-0 flex items-center px-2 py-[5px] bg-inset border-r border-borderSubtle/40 font-mono text-[10px] font-semibold tnum text-textSecondary">
                {row.strike % 1 === 0 ? row.strike.toFixed(0) : row.strike.toFixed(2)}
              </span>
              {/* Value — the only heatmap-tinted part of the row */}
              <span
                style={heatCellStyle(row.value, ladderMaxAbs)}
                className="flex-grow flex items-center justify-end gap-1.5 px-2.5 py-[5px] font-mono text-[11px] font-semibold tnum transition-colors duration-700"
              >
                {/* Holo silver — same supreme marker as the matrix, and the only
                    accent that survives sitting on either heat pole */}
                {row.supreme && <span className="inline-block w-1.5 h-1.5 rounded-full holo-bg" />}
                {fmtUsd(row.value)}
              </span>
            </div>
            {i === spotAfterIndex && <SpotMarker ticker={ticker} spot={spot} />}
          </div>
        ))}
      </div>

      <div className="px-2.5 py-1.5 border-t border-borderSubtle flex items-center justify-between select-none shrink-0">
        <span className="font-mono text-[9px] text-textMuted uppercase tracking-wider">Net</span>
        <span className={`font-mono text-[10px] font-bold tnum ${total >= 0 ? 'text-bull' : 'text-bear'}`}>
          {fmtUsd(total)}
        </span>
      </div>
    </div>
  );
};

const SpotMarker = ({ ticker, spot }: { ticker: string; spot: number }) => (
  <div className="px-2 py-1">
    <SpotRule ticker={ticker} price={spot} />
  </div>
);

export default StrikeLadder;
