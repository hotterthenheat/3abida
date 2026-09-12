/*
==================================================
  SLAYER TERMINAL - KEY LEVELS RAIL
  (components/gex/KeyLevelsRail.tsx)

  The compact structural table: level, distance,
  parked pressure. It grew into a distance-scaled
  ladder for a day (2026-08-26) and came straight
  back (Noah: "revert the levels to look how they
  prev did since they are apart of the strike
  pressure ladder") — as a VIEW of the pressure
  ladder the geometry is already on the other tab,
  so the summary's job is to be a summary.
==================================================
*/

import { fmtUsd } from '../../data/gex';
import Term from '../ui/Term';
import type { TermKey } from '../../data/terms';
import type { KeyLevelKind, KeyLevelRow } from '../../types/gex';

interface KeyLevelsRailProps {
  rows: KeyLevelRow[];
  maxPressure: number;
  /** Click a level to flash it on the chart */
  onSelect?: (price: number) => void;
  /** Re-denominated surfaces (the instrument lens) pass their own print —
      default keeps the native strike style. */
  priceFormat?: (price: number) => string;
}

// Level identity colors — same hierarchy as the chart price lines
const KIND_TEXT: Record<KeyLevelKind, string> = {
  'call-wall': 'text-bull',
  'put-wall': 'text-bear',
  flip: 'text-flip',
  supreme: 'text-supreme',
  pin: 'text-textSecondary',
  spot: 'text-textPrimary',
};

const KIND_BAR: Record<KeyLevelKind, string> = {
  'call-wall': 'bg-bull/90',
  'put-wall': 'bg-bear/80',
  flip: 'bg-flip/60',
  supreme: 'bg-supreme/60',
  pin: 'bg-textMuted/60',
  spot: 'bg-textPrimary/60',
};

/** Each structural level explains itself on hover (the Term sweep, 2026-08-19) */
const KIND_TERM: Partial<Record<KeyLevelKind, TermKey>> = {
  'call-wall': 'Call wall',
  'put-wall': 'Put wall',
  flip: 'Gamma flip',
  pin: 'Pin',
  supreme: 'Supreme',
};

/** Price-ordered ladder of structural levels: distance from spot + parked exposure. */
const KeyLevelsRail = ({ rows, maxPressure, onSelect, priceFormat }: KeyLevelsRailProps) => (
  <div className="flex flex-col">
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-2.5 py-1.5 border-b border-borderSubtle font-mono text-[8px] font-semibold uppercase tracking-widest text-textMuted select-none">
      <span>Level</span>
      <span className="text-right w-14">Dist</span>
      <span className="text-right w-16">Pressure</span>
    </div>
    {rows.map(row => {
      const isSpot = row.kind === 'spot';
      const pct = Math.min(100, (row.pressure / (maxPressure || 1)) * 100);
      return (
        <div
          key={row.kind}
          role={onSelect ? 'button' : undefined}
          onClick={onSelect ? () => onSelect(row.price) : undefined}
          title={onSelect ? 'Flash on chart' : undefined}
          className={`grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-2.5 py-[7px] border-b border-borderSubtle/30 last:border-0 transition-colors ${
            isSpot ? 'bg-ink/[0.04]' : ''
          } ${onSelect ? 'cursor-pointer hover:bg-ink/[0.03]' : ''}`}
        >
          <span className="min-w-0">
            <span className={`block font-mono text-[10px] font-semibold uppercase tracking-wider ${KIND_TEXT[row.kind]}`}>
              {KIND_TERM[row.kind] ? <Term k={KIND_TERM[row.kind] as TermKey}>{row.label}</Term> : row.label}
            </span>
            <span className="block font-mono text-[11px] font-bold tnum text-textPrimary">
              {priceFormat ? priceFormat(row.price) : row.price % 1 === 0 ? row.price.toFixed(0) : row.price.toFixed(2)}
            </span>
          </span>
          <span
            className={`w-14 text-right font-mono text-[10px] tnum ${
              isSpot ? 'text-textMuted' : row.distPct >= 0 ? 'text-bull' : 'text-bear'
            }`}
          >
            {isSpot ? '—' : `${row.distPct >= 0 ? '+' : ''}${row.distPct.toFixed(2)}%`}
          </span>
          <span className="w-16 text-right">
            <span className="block font-mono text-[10px] tnum text-textSecondary">
              {isSpot ? '—' : fmtUsd(row.pressure)}
            </span>
            {!isSpot && (
              <span className="mt-0.5 ml-auto block h-[2px] w-full rounded-full bg-ink/[0.04]">
                <span className={`block h-full rounded-full ${KIND_BAR[row.kind]}`} style={{ width: `${pct}%` }} />
              </span>
            )}
          </span>
        </div>
      );
    })}
  </div>
);

export default KeyLevelsRail;
