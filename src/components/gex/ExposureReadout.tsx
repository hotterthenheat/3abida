/*
  Every figure for one cell — strike and expiry — the ledger on demand,
  plus the strike netted across every expiry drawn: the floating house
  card under the pointer. Nothing here is allowed to bleed: the calendar
  line wraps into its own row (the pointer card once overran its edge on
  "498 across 7 expiries").
*/

import { fmtUsd } from '../../data/gex';
import CompanyLogo from '../ui/CompanyLogo';
import { GREEKS, GREEK_UNIT, type ExposureSurface, type Greek } from '../../data/exposureSurface';
import { BULL, LONG_GAMMA, PUT_WALL, SHORT_GAMMA } from './paletteInk';
import type { SurfaceCell } from './exposureView';

interface ExposureReadoutProps {
  surface: ExposureSurface;
  cell: SurfaceCell;
  /** Expiries drawn — the calendar line nets over these */
  depth: number;
  openRatio?: Map<number, number> | null;
  /** Why this node is shown, when it is not under the pointer ("pinned", "the supreme") */
  caption?: string;
}

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const PUT_INK = '#F5C542';
const CALL_INK = '#7ABDD7';

/** The net's ink per greek — gamma speaks regime, delta speaks direction, vega, vanna and charm stay plain. */
export const netInk = (greek: Greek, v: number): string =>
  greek === 'gex' ? (v >= 0 ? SHORT_GAMMA : LONG_GAMMA) : greek === 'dex' ? (v >= 0 ? BULL : PUT_WALL) : '#EDEDED';

const ExposureReadout = ({ surface, cell, depth, openRatio, caption }: ExposureReadoutProps) => {
  const s = surface.strikes.indexOf(cell.strike);
  const ex = surface.expiries[cell.e];
  if (s < 0 || !ex) return null;
  const g = surface.net.gex[cell.e][s];
  const ratio = cell.e === 0 ? openRatio?.get(cell.strike) : undefined;
  const since = ratio != null && Number.isFinite(ratio) && ratio > 0 ? (1 / ratio - 1) * 100 : null;
  const shown = Math.min(depth, surface.expiries.length);
  const acrossCalendar = (greek: Greek) => {
    let t = 0;
    for (let e = 0; e < shown; e++) t += surface.net[greek][e][s];
    return t;
  };
  const distPct = ((cell.strike - surface.spot) / surface.spot) * 100;
  const line = (greek: Greek) => (
    <div key={greek} className="flex items-baseline gap-2 font-mono text-[10px] tnum whitespace-nowrap">
      <span className="w-8 text-textMuted uppercase tracking-wider">{greek}</span>
      <span className="w-14 text-[8px] text-textMuted/70 uppercase tracking-wider">{GREEK_UNIT[greek]}</span>
      <span style={{ color: PUT_INK }}>{fmtUsd(surface.put[greek][cell.e][s])}</span>
      <span style={{ color: CALL_INK }}>{fmtUsd(surface.call[greek][cell.e][s])}</span>
      <span className="ml-auto font-bold" style={{ color: netInk(greek, surface.net[greek][cell.e][s]) }}>
        {fmtUsd(surface.net[greek][cell.e][s])}
        {/* the star = the heaviest single cell; the supreme (the book's heaviest strike) wears its word in magenta */}
        {surface.king[greek].e === cell.e && surface.king[greek].strike === cell.strike && <span className="ml-1 text-textPrimary">★</span>}
        {surface.supreme[greek].strike === cell.strike && <span className="ml-1 text-[8px] uppercase tracking-widest text-[#EA00FF]">supreme</span>}
      </span>
    </div>
  );
  return (
    <div className="flex flex-col gap-1 min-w-[280px]">
      <div className="flex items-baseline gap-2 font-mono">
        <span className="text-[12px] font-bold text-textPrimary tnum inline-flex items-center gap-1.5">
          <CompanyLogo ticker={surface.ticker} size={13} />
          {surface.ticker} {fmtStrike(cell.strike)}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-textSecondary">
          {ex.date} <span className="text-textMuted">· {cell.e === 0 ? 'today' : ex.short}</span>
        </span>
        <span className="ml-auto text-[9px] text-textMuted tnum">
          {distPct >= 0 ? '+' : ''}
          {distPct.toFixed(2)}% · OI {surface.oi[cell.e][s].toLocaleString('en-US')}
        </span>
      </div>
      {caption && <div className="font-mono text-[8px] uppercase tracking-widest text-textMuted">{caption}</div>}
      <div className="font-mono text-[9px] tracking-wide" style={{ color: g >= 0 ? SHORT_GAMMA : LONG_GAMMA }}>
        {g >= 0 ? 'peak' : 'well'} — dealer hedging {g >= 0 ? 'amplifies a move' : 'absorbs one'} here
      </div>
      <div className="flex items-baseline gap-2 font-mono text-[8px] uppercase tracking-wider text-textMuted/70">
        <span className="w-8" />
        <span className="w-14" />
        <span>put</span>
        <span>call</span>
        <span className="ml-auto">net</span>
      </div>
      {GREEKS.map(line)}
      {/* The strike's ring: the same strike netted across every expiry drawn — its own rows, so it never bleeds */}
      <div className="pt-1 border-t border-borderSubtle/60 font-mono tnum">
        <div className="text-[8px] uppercase tracking-wider text-textMuted">
          {fmtStrike(cell.strike)} across {shown === 1 ? 'today' : `${shown} expiries`}
        </div>
        <div className="mt-0.5 flex items-baseline gap-3 text-[10px]">
          {GREEKS.map(greek => {
            const t = acrossCalendar(greek);
            return (
              <span key={greek} className="inline-flex items-baseline gap-1">
                <span className="text-[8px] uppercase tracking-wider text-textMuted/70">{greek}</span>
                <span className="font-semibold" style={{ color: netInk(greek, t) }}>
                  {fmtUsd(t)}
                </span>
              </span>
            );
          })}
        </div>
      </div>
      {since != null && (
        <div className="pt-1 border-t border-borderSubtle/60 font-mono text-[9px] text-textMuted tnum">
          net gamma since the open:{' '}
          <span className={since >= 0 ? 'text-textPrimary' : 'text-textSecondary'}>
            {since >= 0 ? 'built' : 'bled'} {Math.abs(since).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default ExposureReadout;
