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
    "The reference grows through the session — each minute's ovals stand against the largest node up to that minute, so a size at 10:00 am and one at 3:00 pm are not measured against the same node.",
  fixed: 'One reference for the whole day: the largest node of the 60 sessions before it, fixed before the open.',
  prior: "One reference for the whole day: the session before's largest node.",
};
export const FLOORS = [0, 0.05, 0.1, 0.25] as const;

/** The legend's two lines, in the reader's words: what full size is, and how a mark reads against it (the owner's orbs
    message, 2026-10-14: "LEGEND with oval swatches: 'size = total gamma at the strike · gold = absorb · violet = amplify ·
    grey = balanced · soft edge = stale'" — the swatches are Terrain's, drawn before each colour's word). FULL SIZE IS THE
    LARGEST NODE (the owner's orbs round 2, 2026-10-15: "Make the reference the largest node of the session so far (no
    look-ahead) … The 'Full size' line follows"): on the session's basis nothing is ever clipped; a fixed or prior
    reference can be passed, and a node past it is drawn at full. */
export function beadLegendLines(l: BeadLegend, asked: ScaleBasis, floor: number): { head: string; tail: string } {
  /* the size stands on the gross gamma at a strike where the tape keeps it, on |net| where it does not */
  /* short: the key before it already says what a size is ("size = total gamma at the strike") */
  const head = l.sizeBy === 'gross' && l.greek === 'gex' ? `Full size = ${usdCompact(l.refG)} per 1%` : `Full size = ${usdCompact(l.refG)} ${l.greek === 'gex' ? 'net gamma per 1% (this tape keeps the net alone)' : UNIT[l.greek]}`;
  const day = nyIsoDate(l.at * 1000);
  const basis =
    l.basis === 'session'
      ? `the session's largest so far, as of ${clock(l.at * 1000)}`
      : l.basis === 'fixed'
        ? `the largest over the ${l.sessions} session${l.sessions === 1 ? '' : 's'} before ${isoDayLabel(day)}, fixed for the day`
        : `the prior session's largest${l.priorDay ? `, ${isoDayLabel(l.priorDay)}` : ''}`;
  const fallback = asked !== l.basis ? ` — ${BASIS_LABEL[asked].toLowerCase()} has no session before ${isoDayLabel(day)} in yet` : '';
  const hidden = floor > 0 ? ` · under ${Math.round(floor * 100)}% of full hidden` : '';
  const clipped = l.basis === 'session' ? '' : ' · larger drawn at full';
  return {
    head: `${head} · ${basis}${fallback}`,
    tail: `size = total gamma at the strike · gold = absorb · violet = amplify · grey = balanced · soft edge = stale${clipped}${hidden}`,
  };
}
/** The legend as one line (its title, and the words check) */
export const beadLegendWords = (l: BeadLegend, asked: ScaleBasis, floor: number): string => {
  const { head, tail } = beadLegendLines(l, asked, floor);
  return `${head} · ${tail}`;
};
