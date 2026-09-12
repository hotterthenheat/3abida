import { DISTANCE_UNITS } from '../../data/atr';
import { setDistanceUnit, useDistanceUnit } from '../../data/distanceUnits';

/*
  T-19's toggle — four chips, one desk-wide store. Every surface that prints
  a distance (the flip strip, the measure box) reads the same unit, so the
  desk cannot show a wall 0.4 ATR away on one line and $14 away on the next
  without the reader having chosen both.
*/

const UNIT_WORDS: Record<string, string> = {
  $: 'dollars',
  '%': 'percent of spot',
  ATR: 'average true ranges — the same distance on SPY and on NVDA',
  σ: 'implied one-day moves — how many σ the options price',
};

const DistanceUnitPicker = ({ dense = false }: { dense?: boolean }) => {
  const unit = useDistanceUnit();
  return (
    <div
      role="group"
      aria-label="Distance unit — desk-wide"
      className={`inline-flex items-center rounded border border-borderSubtle overflow-hidden ${dense ? '' : 'ml-auto'}`}
    >
      {DISTANCE_UNITS.map(u => (
        <button
          key={u}
          onClick={() => setDistanceUnit(u)}
          aria-pressed={unit === u}
          title={`Distances in ${UNIT_WORDS[u]}`}
          className={`px-1.5 h-[20px] font-mono text-[10px] tnum transition-colors ${
            unit === u ? 'bg-ink/[0.10] text-textPrimary font-semibold' : 'text-textMuted hover:text-textPrimary'
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
};

export default DistanceUnitPicker;
