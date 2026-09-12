import { useMemo } from 'react';
import { Fragment } from 'react';
import { buildOiHeat, rowWords, type OiHeat } from '../../data/oiHeat';
import SpotRule from '../ui/SpotRule';
import Term from '../ui/Term';
import type { Candle, GexSnapshot } from '../../types/market';

/*
==================================================
  SLAYER TERMINAL - ΔOI HEAT — P-8
  (components/gex/OiHeatPanel.tsx)
==================================================

  Rows = strikes, columns = time, cells = CHANGE. The map is a snapshot of
  a stock; this is the flow that answers "is that wall growing or dying".

  ΔOI HAS A HOUSE PATTERN AND THIS PANEL NOW FOLLOWS IT. PressureMatrix has
  drawn open-interest change the same way since the desk existed: an ↑ or ↓
  arrow with the number, bull green for building and bear red for unwinding,
  and INK ONLY ON THE DELTAS THAT MATTER — the top quintile by magnitude —
  because forty red/green arrows is noise and a handful is signal.

  It took two wrong rounds to land here, which is why the rule is written
  out. Round one painted red/green background washes (the generic heatmap
  this desk moved off). Round two "fixed" that to steel/gold washes — but
  steel/gold mean CALL SIDE and PUT SIDE everywhere else, and a strike
  gaining open interest has not picked a side, it has changed size. The
  house already had the answer; neither round looked for it. A surface that
  wants an established meaning derives from the component that owns it.

  WHEN THERE IS NOTHING TO SHOW IT SAYS SO. A session that has not recorded
  two snapshots yet has no flow to report, and the panel says exactly that
  rather than drawing an empty grid that looks like a quiet day.
*/

const OiHeatPanel = ({
  snaps,
  bars,
  buckets = 8,
  maxRows = 12,
  ticker,
  spot,
  fill = false,
  heat: heatProp,
  onSelectStrike,
}: {
  snaps: GexSnapshot[];
  bars: Candle[];
  buckets?: number;
  /** Page-hosted, the grid can afford more rows than a side panel could. */
  maxRows?: number;
  /** Both present → the spot rule embeds between rows, the matrix idiom. */
  ticker?: string;
  spot?: number;
  /** Page-hosted: stretch rows to the container, the matrix's fill trick. */
  fill?: boolean;
  /**
   * A precomputed grid, so a host can derive OTHER surfaces from the SAME
   * result. Two separate buildOiHeat calls at different render moments can
   * straddle a session roll (the sim mutates its arrays in place) —
   * measured as the rail honestly reporting a fresh session beside a grid
   * still drawing the previous one. One result, passed down, cannot
   * disagree with itself.
   */
  heat?: OiHeat;
  /** A strike cell was clicked — hosts wire this to the chart's focus
      flash, the same door every ladder on the desk opens. */
  onSelectStrike?: (strike: number) => void;
}) => {
  /* The self-computed grid keys on array IDENTITY, and the sim mutates its
     arrays in place — so this memo freezes at first compute. Fine for a
     side panel alone; a host deriving sibling surfaces passes `heat` so
     everything reads ONE result (see the prop note). */
  const computed = useMemo(() => buildOiHeat(snaps, bars, buckets), [snaps, bars, buckets]);
  const heat = heatProp ?? computed;

  if (!heat.hasOi || heat.rows.length === 0) {
    return (
      <div className="font-mono text-[10px] leading-relaxed text-textMuted">
        No position flow recorded yet this session — the grid needs at least two snapshots of the book to
        have a change to show.
      </div>
    );
  }

  /* PressureMatrix's significance rule, verbatim in spirit: the top
     quintile of |ΔOI| across the grid carries ink, everything else stays
     quiet. */
  const magnitudes = heat.rows.flatMap(r => r.cells.map(c => Math.abs(c.deltaOi))).sort((a, b) => a - b);
  const significantAbs = magnitudes.length ? magnitudes[Math.floor(magnitudes.length * 0.8)] : 0;
  const cellClass = (v: number) => {
    if (v === 0) return 'text-textMuted';
    const significant = significantAbs > 0 && Math.abs(v) >= significantAbs;
    return significant ? (v > 0 ? 'text-bull font-semibold' : 'text-bear font-semibold') : 'text-textSecondary';
  };

  const hhmm = (t: number) => {
    const d = new Date(t * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  /* The busiest strikes first — a grid of every strike is unreadable, and
     the rows worth showing are the ones where something HAPPENED. */
  const rows = [...heat.rows]
    .sort((a, b) => Math.abs(b.netToday) - Math.abs(a.netToday))
    .slice(0, maxRows)
    .sort((a, b) => b.strike - a.strike);
  const spotAfter = spot !== undefined ? rows.findIndex((r, i) => r.strike >= spot && (rows[i + 1]?.strike ?? -Infinity) < spot) : -1;
  return (
    <div className={`flex flex-col gap-2 ${fill ? 'flex-grow min-h-0' : ''}`}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-widest text-textMuted">
          <Term k="ΔOI heat">Built and unwound</Term>
        </span>
        <span className="font-mono text-[9px] text-textMuted">
          {heat.hasFlex ? 'with the FLEX transfer split' : 'FLEX transfers not on this account — shown as —'}
        </span>
      </div>

      <div className={`overflow-auto ${fill ? 'flex-1 min-h-0' : ''}`}>
        <table className={`w-full border-collapse ${fill ? 'h-full' : ''}`}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-chip">
              <th className="w-px px-2 py-1.5 text-left font-mono text-[9px] font-semibold uppercase tracking-widest text-textMuted border-b border-borderSubtle whitespace-nowrap">
                Strike
              </th>
              {heat.columns.map(c => (
                <th key={c} className="px-2 py-1.5 text-right font-mono text-[9px] font-semibold uppercase tracking-widest text-textMuted border-b border-borderSubtle tnum">
                  {hhmm(c)}
                </th>
              ))}
              <th className="px-2 py-1.5 text-right font-mono text-[9px] font-semibold uppercase tracking-widest text-textPrimary border-b border-l border-borderSubtle">
                Net
              </th>
              <th className="px-2 py-1.5 text-right font-mono text-[9px] font-semibold uppercase tracking-widest text-textMuted border-b border-borderSubtle">
                FLEX
              </th>
            </tr>
          </thead>
          <tbody>
            {spot !== undefined && ticker && spotAfter === -1 && rows.length > 0 && spot > rows[0].strike && (
              <tr>
                <td colSpan={heat.columns.length + 3} className="px-2 py-1">
                  <SpotRule ticker={ticker} price={spot} />
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <Fragment key={r.strike}>
              <tr title={rowWords(r)} className="border-b border-borderSubtle/40 last:border-0">
                <td
                  onClick={onSelectStrike ? () => onSelectStrike(r.strike) : undefined}
                  title={onSelectStrike ? 'Flash on chart' : undefined}
                  className={`w-px px-2 py-1 font-mono text-[11px] font-semibold tnum text-textPrimary whitespace-nowrap ${
                    onSelectStrike ? 'cursor-pointer hover:text-white' : ''
                  }`}
                >
                  {r.strike}
                </td>
                {r.cells.map(c => (
                  <td
                    key={c.time}
                    title={`${r.strike} · ${hhmm(c.time)} · calls ${c.deltaCall >= 0 ? '+' : ''}${c.deltaCall} · puts ${c.deltaPut >= 0 ? '+' : ''}${c.deltaPut}`}
                    className={`px-1.5 py-0.5 text-right font-mono text-[10px] tnum ${cellClass(c.deltaOi)}`}
                  >
                    {c.deltaOi === 0 ? '·' : `${c.deltaOi > 0 ? '↑' : '↓'}${Math.abs(c.deltaOi).toLocaleString()}`}
                  </td>
                ))}
                <td className="px-1.5 py-0.5 text-right font-mono text-[10px] font-semibold tnum text-textPrimary border-l border-borderSubtle/40">
                  {r.netToday > 0 ? '+' : ''}
                  {r.netToday.toLocaleString()}
                </td>
                {/* Null, not zero — "we cannot see transfers" is not "there
                    were none". The em-dash is the honest render. */}
                <td className="px-1.5 py-0.5 text-right font-mono text-[10px] tnum text-textMuted">
                  {r.cells.every(c => c.flexTransfer === null)
                    ? '—'
                    : r.cells.reduce((a, c) => a + (c.flexTransfer ?? 0), 0).toLocaleString()}
                </td>
              </tr>
              {i === spotAfter && spot !== undefined && ticker && (
                <tr>
                  <td colSpan={heat.columns.length + 3} className="px-2 py-1">
                    <SpotRule ticker={ticker} price={spot} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[9px] leading-relaxed text-textMuted">
        Change, not level: a strike parked at the same open interest all day is blank here, and should be.
        ↑ builds in green, ↓ unwinds in red — and only the deltas that matter carry ink, the same
        top-quintile rule the pressure matrix uses.
      </p>
    </div>
  );
};

export default OiHeatPanel;
