import { useMemo } from 'react';
import { buildStability, stabilityWords, VOL_BUMP } from '../../data/stability';
import Term from '../ui/Term';
import type { MarketSnapshot } from '../../types/market';

/*
==================================================
  SLAYER TERMINAL - MAP STABILITY GAUGE — P-11
  (components/gex/StabilityGauge.tsx)
==================================================

  AT THE HEAD OF THE PAGE, because it qualifies everything under it. A
  reader who scrolls past a wall without knowing whether a vol tick would
  dissolve it has been told something less true than the number looks.

  A SENTENCE, NOT A DIAL. "A ±2 vol move relocates the flip by 14 and
  changes which strike is the wall" is the read; a STABLE badge would be the
  same information with the actionable half removed. The before/after
  levels sit underneath for a reader who wants to see the arithmetic.

  NO ALARM INK. This is not a warning — a map that moves under vol is
  ordinary and knowing it is an edge, not a fault — so it wears the same
  steel as every other piece of context on the desk.
*/

const StabilityGauge = ({ snapshot, iv }: { snapshot: MarketSnapshot; iv: number }) => {
  const read = useMemo(() => buildStability(snapshot.chain, snapshot.spot, iv), [snapshot.chain, snapshot.spot, iv]);
  if (!read) return null;

  const rows: { label: string; base: number | null; up: number | null; down: number | null }[] = [
    { label: 'Call wall', base: read.base.callWall, up: read.up.callWall, down: read.down.callWall },
    { label: 'Put wall', base: read.base.putWall, up: read.up.putWall, down: read.down.putWall },
    { label: 'Gamma flip', base: read.base.flip, up: read.up.flip, down: read.down.flip },
  ];
  const num = (v: number | null) => (v === null ? '—' : v.toFixed(2));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-widest text-textMuted">
          <Term k="Map stability">Does this map hold</Term>
        </span>
      </div>
      <p className="font-mono text-[12px] leading-relaxed text-textPrimary">{stabilityWords(read)}</p>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              {['Level', 'now', `−${(VOL_BUMP * 100).toFixed(0)} vol`, `+${(VOL_BUMP * 100).toFixed(0)} vol`].map(h => (
                <th
                  key={h}
                  className="px-2 py-0.5 text-left font-mono text-[9px] uppercase tracking-wider text-textMuted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const moved = r.base !== r.up || r.base !== r.down;
              return (
                <tr key={r.label}>
                  <td className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-textMuted">{r.label}</td>
                  <td className="px-2 py-0.5 font-mono text-[11px] font-semibold tnum text-textPrimary">{num(r.base)}</td>
                  <td className={`px-2 py-0.5 font-mono text-[11px] tnum ${moved ? 'text-textPrimary' : 'text-textMuted'}`}>
                    {num(r.down)}
                  </td>
                  <td className={`px-2 py-0.5 font-mono text-[11px] tnum ${moved ? 'text-textPrimary' : 'text-textMuted'}`}>
                    {num(r.up)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StabilityGauge;
