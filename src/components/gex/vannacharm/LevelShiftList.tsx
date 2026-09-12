import { MoveRight } from 'lucide-react';
import type { KeyLevelKind, LevelShift } from '../../../types/gex';

interface LevelShiftListProps {
  shifts: LevelShift[];
}

const KIND_TEXT: Record<KeyLevelKind, string> = {
  'call-wall': 'text-bull',
  'put-wall': 'text-bear',
  flip: 'text-flip',
  supreme: 'text-supreme',
  pin: 'text-textSecondary',
  spot: 'text-textPrimary',
};

const fmt = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

/** Current → projected for each structural level, delta called out. */
const LevelShiftList = ({ shifts }: LevelShiftListProps) => (
  <div className="flex flex-col">
    <div className="grid grid-cols-[1fr_auto] gap-x-3 px-2.5 py-1.5 border-b border-borderSubtle font-mono text-[8px] font-semibold uppercase tracking-widest text-textMuted select-none">
      <span>Level</span>
      <span className="text-right">Now → Scenario</span>
    </div>
    {shifts.map(s => {
      const delta = s.projected - s.current;
      const moved = delta !== 0;
      return (
        <div
          key={s.kind}
          className="grid grid-cols-[1fr_auto] gap-x-3 items-center px-2.5 py-[8px] border-b border-borderSubtle/30 last:border-0"
        >
          <span className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${KIND_TEXT[s.kind]}`}>
            {s.label}
          </span>
          <span className="flex items-center gap-1.5 justify-end">
            <span className="font-mono text-[11px] font-bold tnum text-textPrimary">{fmt(s.current)}</span>
            <MoveRight className={`w-3 h-3 ${moved ? 'text-textSecondary' : 'text-textMuted/40'}`} />
            <span className={`font-mono text-[11px] font-bold tnum ${moved ? 'text-textPrimary' : 'text-textMuted'}`}>
              {fmt(s.projected)}
            </span>
            <span
              className={`w-12 text-right font-mono text-[9px] tnum ${
                !moved ? 'text-textMuted' : delta > 0 ? 'text-bull/90' : 'text-bear/90'
              }`}
            >
              {moved ? `${delta > 0 ? '+' : ''}${fmt(delta)}` : 'holds'}
            </span>
          </span>
        </div>
      );
    })}
  </div>
);

export default LevelShiftList;
