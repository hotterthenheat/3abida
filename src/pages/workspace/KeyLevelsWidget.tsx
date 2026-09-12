/*
==================================================
  SLAYER TERMINAL - PULSE DESK · KEY LEVELS
  The structural ladder with the INSTRUMENT LENS
  (Noah, 2026-08-18): on index-family names the
  walls, flip, pin and supreme re-denominate into the
  cash index or the futures — SPY · SPX · ES — so
  the map reads in the instrument you trade.
  Distances recompute against the converted spot
  (the basis shifts absolutes, honesty demands the
  percentages follow). Non-index names never show
  the lens.

  NOT A STANDALONE PANEL any more (Noah, 2026-08-26:
  "it just doesnt have enough information to be a
  stand alone") — this is the Strike Pressure
  Ladder's LEVELS VIEW, mounted by its view strip.
  Same book, summary altitude.
==================================================
*/

import { useMemo, useState } from 'react';
import KeyLevelsRail from '../../components/gex/KeyLevelsRail';
import DropdownSelect from '../../components/ui/DropdownSelect';
import { twinBasis, twinFamilyFor, twinLabel, twinPrice, fmtTwin, type TwinLensKey } from '../../data/indexTwins';
import type { KeyLevelRow } from '../../types/gex';
import type { WorkspaceCtx } from './registry';

/** The Levels view off any book — the desk's, or the Pinpoint ladder's own
    (2026-09-05: one card, two homes). */
export const KeyLevelsView = ({ ticker, rows, spot }: { ticker: string; rows: KeyLevelRow[]; spot: number }) => {
  const [lens, setLens] = useState<TwinLensKey>('etf');
  const fam = twinFamilyFor(ticker);
  const active: TwinLensKey = fam ? lens : 'etf';

  const maxPressure = rows.reduce((a, l) => Math.max(a, l.pressure), 1);
  const etfSpot = rows.find(r => r.kind === 'spot')?.price ?? spot;

  const shown = useMemo(() => {
    if (!fam || active === 'etf') return rows;
    const spotTwin = twinPrice(fam, active, etfSpot, etfSpot);
    return rows.map(r => {
      const price = twinPrice(fam, active, r.price, etfSpot);
      return {
        ...r,
        price,
        distPct: r.kind === 'spot' ? 0 : ((price - spotTwin) / (spotTwin || 1)) * 100,
      };
    });
  }, [rows, fam, active, etfSpot]);

  return (
    <div className="h-full min-h-0 flex flex-col">
      {fam && (
        <div className="shrink-0 px-2 py-1.5 border-b border-borderSubtle/60 flex items-center gap-2 flex-wrap">
          <DropdownSelect
            label="Prices in"
            value={active}
            options={(['etf', 'index', 'futures'] as TwinLensKey[]).map(k => ({ value: k, label: twinLabel(fam, k) }))}
            onChange={setLens}
            title="The instrument the levels are priced in"
            testId="levels-instrument"
          />
          {/* The conversion state is itself a read — the carry, spoken. */}
          <span className="ml-auto font-mono text-[9px] text-textMuted tnum">
            {fam.futures} {fmtTwin(twinPrice(fam, 'futures', etfSpot, etfSpot))} · +{fmtTwin(twinBasis(fam, etfSpot))} over {fam.index}
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <KeyLevelsRail
          rows={shown}
          maxPressure={maxPressure}
          priceFormat={fam && active !== 'etf' ? fmtTwin : undefined}
        />
      </div>
    </div>
  );
};

const KeyLevelsWidget = ({ ctx }: { ctx: WorkspaceCtx }) => <KeyLevelsView ticker={ctx.ticker} rows={ctx.pulse.keyLevels} spot={ctx.gex.levels.spot} />;

export default KeyLevelsWidget;
