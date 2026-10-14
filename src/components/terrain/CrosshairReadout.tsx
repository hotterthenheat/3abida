/*
  THE CROSSHAIR READOUT (the Terrain UI pass, 2026-10-14 — the owner: "OHLC into a crosshair readout at the plot's
  top-left"): the hovered bar's open, high, low, close, volume and indicator values, one quiet line at the plot's
  top-left under the chrome — only while a pointer is on the plot, or a moment arrives from another pane. Every figure
  through the house's formatter (core/format), tabular.
*/
import { num, numCompact } from '../../core/format';
import type { CrosshairBar } from '../gex/StrikeChart';

interface Props {
  readout: CrosshairBar;
  showOhl: boolean;
  showVol: boolean;
  showInds: boolean;
  /** The bar's own time on the reader's clock, where the host has it */
  when?: string;
  className?: string;
}

const Cell = ({ k, v, ink }: { k: string; v: string; ink?: string }) => (
  <span className="shrink-0 whitespace-nowrap">
    <span className="font-mono text-[11px] text-textMuted">{k}</span>
    <span className="ml-1 font-mono text-[11px] tnum text-textSecondary" style={ink ? { color: ink } : undefined}>
      {v}
    </span>
  </span>
);

const CrosshairReadout = ({ readout, showOhl, showVol, showInds, when, className = '' }: Props) => (
  <div className={`pointer-events-none select-none w-fit max-w-full rounded-md bg-canvas/25 backdrop-blur-[3px] px-2 py-0.5 flex items-center gap-2.5 whitespace-nowrap ${className}`} data-crosshair-readout>
    {when && <span className="font-mono text-[11px] tnum text-textMuted">{when}</span>}
    {showOhl && readout.open != null && readout.high != null && readout.low != null && (
      <>
        <Cell k="O" v={num(readout.open, 2)} />
        <Cell k="H" v={num(readout.high, 2)} />
        <Cell k="L" v={num(readout.low, 2)} />
      </>
    )}
    <Cell k="C" v={num(readout.close, 2)} />
    {showVol && readout.volume != null && <Cell k="V" v={numCompact(readout.volume)} />}
    {showInds && readout.indicators.map(ind => <Cell key={ind.key} k={ind.key} v={num(ind.value, 2)} ink={ind.ink} />)}
  </div>
);

export default CrosshairReadout;
