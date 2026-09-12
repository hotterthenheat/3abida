import { fmtUsd } from '../../data/gex';
import { heatPoles, heatScaleGradient, heatScaleLabels } from './heatmap';
import HeatPill, { HiddenStrikes } from './HeatPill';
import { foldQuietStrikes } from './foldStrikes';
import { SUPREME } from './paletteInk';
import type { GexMatrixData } from '../../types/gex';

interface GexMatrixProps {
  data: GexMatrixData;
  spot: number;
  /** Stretch to the container: rows share the extra height natively (the
      premium-ladder trick). The fullscreen takeover uses this — without it
      the grid hugged ~600px and left the viewport empty underneath (Noah,
      2026-08-18). Off by default so small tiles keep hugging their content. */
  fill?: boolean;
  /** Re-denominate the strike column (the instrument lens) — default prints
      the native strike. */
  strikeFormat?: (strike: number) => string;
  /**
   * A muted trailing column of row-level words — the expiry ladder's
   * composition read. Lives HERE rather than in a fork of the table so
   * every strike×column heat surface stays one component: the ladder that
   * first needed it shipped its own grid in a foreign design, and this prop
   * is what made deleting that fork possible.
   */
  rowNotes?: (string | null)[];
  rowNotesLabel?: string;
  /** First column in warn ink — the 0DTE emphasis. A time-bucketed surface
      (the time machine) turns it off: its first column is just a moment. */
  warnFirstColumn?: boolean;
  /** A strike row was clicked — hosts wire this to the chart's focus flash,
      the same door every ladder on the desk opens. Absent, rows stay inert. */
  onSelectStrike?: (strike: number) => void;
}

/**
 * Strike × expiry exposure heatmap. Cell palette comes from heatmap.ts
 * (mono or diverging mode); values are always printed and the digit color
 * flips by cell luminance, so color is never the only channel.
 */
const GexMatrix = ({ data, fill = false, strikeFormat, rowNotes, rowNotesLabel = 'Composition', warnFirstColumn = true, onSelectStrike }: GexMatrixProps) => {
  const { expiries, strikes, cells, maxAbs, spotRowIndex, callWallIndex, putWallIndex } = data;

  /*
    THE QUIET RUNS FOLD.

    A chain is mostly empty away from the money, and forty near-zero rows bury
    the dozen that matter. The fold says how many went — a surface that drops
    rows without saying so is lying about the chain it claims to show — and it
    never touches the band around spot, however quiet, because a zero two ticks
    from the money is a fact about the book rather than the chain being long.
  */
  const folded = foldQuietStrikes(
    /* Folded over row INDICES, not strikes: a row's loudness is the heaviest
       cell across its expiries, which lives in `cells`, not in the strike. */
    strikes.map((_, i) => i),
    i => cells[i]?.reduce((m, c) => Math.max(m, Math.abs(c.value)), 0) ?? 0,
    maxAbs,
    spotRowIndex
  );

  return (
    // Default max-h-full, not h-full: when the grid is shorter than its
    // container the block hugs the table, so the scale bar stops running past
    // the last row into empty space. Taller than the container and it still
    // scrolls. `fill` flips both: the table stretches to the box instead.
    /* w-full: in a block host this changes nothing, but as a FLEX child the
       root used to shrink to the table's content width — the scale rail
       stranded mid-panel with a dead band to its right. A surface claims
       its container. */
    <div className={`flex gap-2 min-h-0 w-full ${fill ? 'h-full' : 'max-h-full'}`}>
      <div className="flex-grow overflow-auto min-w-0">
        <table className={`w-full border-collapse ${fill ? 'h-full' : ''}`}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-chip">
              {/* w-px + whitespace-nowrap = shrink to content. Without it the
                  auto table layout hands this column a share of the leftover
                  width, which at fullscreen left a ~320px gap before the data. */}
              <th className="w-px px-2 py-1.5 text-left font-mono text-[9px] font-semibold uppercase tracking-widest text-textMuted border-b border-borderSubtle whitespace-nowrap">
                Strike
              </th>
              {expiries.map((exp, i) => (
                <th
                  key={exp}
                  className={`px-2 py-1.5 text-right font-mono text-[9px] font-semibold uppercase tracking-widest border-b border-borderSubtle ${
                    warnFirstColumn && i === 0 ? 'text-warn' : 'text-textMuted'
                  }`}
                >
                  {exp}
                </th>
              ))}
              {rowNotes && (
                <th className="px-2 py-1.5 text-left font-mono text-[9px] font-semibold uppercase tracking-widest text-textMuted border-b border-borderSubtle">
                  {rowNotesLabel}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {folded.map((entry, k) => {
              if (entry.kind === 'hidden') {
                return (
                  <tr key={`hidden-${k}`}>
                    <td colSpan={expiries.length + 1 + (rowNotes ? 1 : 0)} className="p-0">
                      <HiddenStrikes count={entry.count} />
                    </td>
                  </tr>
                );
              }
              const r = entry.row;
              const strike = strikes[r];
              const isSpot = r === spotRowIndex;
              const isCallWall = r === callWallIndex;
              const isPutWall = r === putWallIndex;
              return (
                <tr
                  key={strike}
                  onClick={onSelectStrike ? () => onSelectStrike(strike) : undefined}
                  title={onSelectStrike ? 'Flash on chart' : undefined}
                  className={`border-b border-borderSubtle/40 last:border-0 ${
                    isSpot ? 'shadow-[inset_2px_0_0_0_rgba(237,237,237,0.6)]' : ''
                  } ${onSelectStrike ? 'cursor-pointer hover:bg-ink/[0.02] transition-colors' : ''}`}
                >
                  <td className="w-px px-2 py-1 font-mono text-[11px] whitespace-nowrap">
                    <span className={isSpot ? 'text-textPrimary font-bold' : 'text-textPrimary font-semibold'}>
                      {strikeFormat ? strikeFormat(strike) : strike % 1 === 0 ? strike.toFixed(0) : strike.toFixed(2)}
                    </span>
                    {isSpot && (
                      <span className="ml-1.5 font-mono text-[8px] font-bold uppercase tracking-wider text-textMuted">
                        spot
                      </span>
                    )}
                    {/* Wall chips wear the FIELD's poles, not bull/bear — a
                        green chip beside a steel row read as two unrelated
                        colors (steel = absorb side = call-dominant, gold =
                        amplify side = put-dominant). Poles come from
                        heatPoles so a mode switch re-inks them. */}
                    {isCallWall && !isSpot && (
                      <span className="ml-1.5 font-mono text-[8px] font-bold uppercase tracking-wider" style={{ color: heatPoles.neg }}>
                        cw
                      </span>
                    )}
                    {isPutWall && !isSpot && (
                      <span className="ml-1.5 font-mono text-[8px] font-bold uppercase tracking-wider" style={{ color: heatPoles.pos }}>
                        pw
                      </span>
                    )}
                  </td>
                  {cells[r].map((cell, c) => (
                    /* The td is now only SPACING — the pill carries the value,
                       and the gap between pills is what separates the columns.
                       py-[2px] is the air that makes a row of them countable. */
                    <td key={c} className="px-[3px] py-[2px]">
                      <HeatPill
                        value={cell.value}
                        maxAbs={maxAbs}
                        selected={cell.supreme}
                        /* Magenta, matching the supreme LINE on the chart — a
                           property of the book, not of what the reader
                           clicked, so it does not wear the selection lime. */
                        ringColor={SUPREME}
                        className="h-[19px]"
                        title={`${strike} · ${expiries[c]} · ${fmtUsd(cell.value)}`}
                      >
                        {fmtUsd(cell.value)}
                      </HeatPill>
                    </td>
                  ))}
                  {rowNotes && (
                    <td className="px-2 py-1 font-mono text-[9px] text-textMuted whitespace-nowrap">
                      {rowNotes[r] ?? ''}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Diverging color scale */}
      <div className="shrink-0 w-9 flex flex-col items-center py-1 select-none">
        <span className={`font-mono text-[9px] tnum ${heatScaleLabels.pos}`}>+{fmtUsd(maxAbs).replace('$', '')}</span>
        <div
          className="flex-grow w-2.5 my-1.5 rounded-full border border-borderSubtle"
          style={{ background: heatScaleGradient }}
        />
        <span className={`font-mono text-[9px] tnum ${heatScaleLabels.neg}`}>−{fmtUsd(maxAbs).replace('$', '')}</span>
        <span className="mt-1 font-mono text-[8px] text-textMuted uppercase">gex</span>
      </div>
    </div>
  );
};

export default GexMatrix;
