/*
  THE BEAD LEGEND'S WORDS (the owner's item 5 (a), 2026-10-14: "Always-visible legend: 'Full brightness = $X gamma per
  1% (session p85 of per-minute peaks, as of <time>)'. State whether a bead is net or per side, and that values above
  p85 are clipped"). Built from the renderer's own hand-off (gexNodesPrimitive `legend()` — the newest column's
  reference, the very number its beads were drawn against), never a figure of its own.
*/
import type { BeadLegend } from '../gex/gexNodesPrimitive';
import type { ScaleBasis } from '../../data/feed/beadScale';
import { usdCompact, isoDayLabel } from '../../core/format';
import { clock, nyIsoDate } from '../../core/nyTime';

const UNIT: Record<BeadLegend['greek'], string> = { gex: 'gamma per 1%', dex: 'delta', vex: 'vega' };
export const BASIS_LABEL: Record<ScaleBasis, string> = { session: 'Session so far', fixed: 'Fixed', prior: 'Prior session' };
export const BASIS_HINT: Record<ScaleBasis, string> = {
  session:
    "The reference grows through the session — each minute's beads stand against the peaks up to that minute, so brightness at 10:00 am and at 3:00 pm is not comparable.",
  fixed: 'One reference for the whole day: the 85th percentile of every minute’s peak over the 60 sessions before it, fixed before the open.',
  prior: "One reference for the whole day: the session before's 85th percentile of its minutes' peaks.",
};
export const FLOORS = [0, 0.05, 0.1, 0.25] as const;

/** The legend's two lines, in the reader's words: what full size is, and how a mark reads against it (the owner's B3,
    2026-10-14: "Legend: 'size = total gamma at the strike · colour = which side wins · grey = balanced · soft edge =
    stale'") */
export function beadLegendLines(l: BeadLegend, asked: ScaleBasis, floor: number): { head: string; tail: string } {
  /* the size stands on the gross gamma at a strike where the tape keeps it, on |net| where it does not */
  const head = l.sizeBy === 'gross' && l.greek === 'gex' ? `Full size = ${usdCompact(l.refG)} total gamma at a strike per 1%` : `Full size = ${usdCompact(l.refG)} ${l.greek === 'gex' ? 'net gamma per 1% (this tape keeps the net alone)' : UNIT[l.greek]}`;
  const day = nyIsoDate(l.at * 1000);
  const basis =
    l.basis === 'session'
      ? `session p85 of per-minute peaks, as of ${clock(l.at * 1000)}`
      : l.basis === 'fixed'
        ? `p85 of per-minute peaks over the ${l.sessions} session${l.sessions === 1 ? '' : 's'} before ${isoDayLabel(day)}, fixed for the day`
        : `p85 of the prior session's per-minute peaks${l.priorDay ? `, ${isoDayLabel(l.priorDay)}` : ''}`;
  const fallback = asked !== l.basis ? ` — ${BASIS_LABEL[asked].toLowerCase()} has no session before ${isoDayLabel(day)} in yet` : '';
  const hidden = floor > 0 ? ` · under ${Math.round(floor * 100)}% of full hidden` : '';
  return {
    head: `${head} (${basis}${fallback})`,
    tail: `size = total gamma at the strike · colour = which side wins · grey = balanced · soft edge = stale · clipped above full${hidden}`,
  };
}
/** The legend as one line (its title, and the words check) */
export const beadLegendWords = (l: BeadLegend, asked: ScaleBasis, floor: number): string => {
  const { head, tail } = beadLegendLines(l, asked, floor);
  return `${head} · ${tail}`;
};
