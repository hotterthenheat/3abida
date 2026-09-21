/*
  THE contract cell (Noah, 2026-08-30, rounds 1+2): it speaks WORDS, never
  abbreviations — "call" and "put" in their own ink, the C/P letter chips
  are dead; every cell ENDS ON THE SAME POINT — one fixed shape, right-
  aligned, a short strike starts later but finishes exactly where the long
  ones do; and the click affordance is a SIMPLE LINE under each one (the
  pill-with-hover read awkward — Noah killed it same day). The line hugs
  the contract's own width, so the underlines stagger left while the
  endings stay flush. WHITE, not the moon blue it launched with (Noah,
  2026-08-30: "make all of my blue underlines white... i dont like how the
  blue looks") — every door on every Trace page wears this same line.

  THE CELL IS COMPOUND WHERE THE CONTEXT IS GIVEN. A strike means nothing
  without the spot it is measured from, and an expiry means nothing without
  the days left in it — yet the tape carried Strike, Expiry, DTE, OTM % and
  Spot as five columns the eye had to re-assemble on every row. They belong
  together, on one sub-line under the contract they describe: this is what
  the print was, and this is where the market was when it happened. Each
  fact is optional, so the surfaces that have no spot to show are unchanged.
*/

import { DOOR, DOOR_GROUP_TEXT } from './door';

/* The COLUMN is right-aligned (header included), so header and endings share
   one edge and read as one parent — the cell itself just hugs its content.
   Hover: the line fills, the strike takes silver; the call/put word keeps
   its own ink — that colour is information, not chrome. */
const ContractCell = ({
  strike,
  right,
  expiry,
  dte,
  spot,
  otmPct,
}: {
  strike: number;
  right: 'C' | 'P';
  expiry: string;
  /** Days to expiry — printed beside the date it belongs to */
  dte?: number;
  /** The underlying when the print crossed, so the strike has a reference */
  spot?: number;
  /** Signed distance of the strike from that spot, percent */
  otmPct?: number;
}) => {
  const context = dte !== undefined || spot !== undefined || otmPct !== undefined;
  /* leading-none + align-middle on the head too, not just on the compound
     form: a table cell hands its children a 36px line height, so this one
     line measured 42px in a 39px row and the door's underline — the whole
     click affordance — was cut off at the bottom on every Trace table. */
  const head = (
    <span className={`group/door inline-flex items-baseline gap-1.5 pb-[2px] leading-none align-middle ${DOOR}`}>
      <span className={`font-mono text-xs font-bold text-textPrimary tnum ${DOOR_GROUP_TEXT}`}>{strike}</span>
      <span className={`font-mono text-[11px] font-semibold ${right === 'C' ? 'text-bull' : 'text-bear'}`}>
        {right === 'C' ? 'call' : 'put'}
      </span>
      <span className="font-mono text-[10px] text-textMuted tnum">{expiry}</span>
    </span>
  );
  /* Without context the cell is EXACTLY what it always was — one line, one
     line box, no wrapper. The surfaces that pass no spot see no change. */
  if (!context) return head;
  /* Two load-bearing utilities. leading-none: a table cell hands its children
     a 36px line height, and two stacked lines of THAT are 75px in a 39px row
     — the second one lands under the clip and simply is not there.
     align-middle: an inline-flex box sits on the line box's BASELINE, so a
     27px stack hangs off it and loses its last line to the row's bottom edge;
     middle centres it on the line instead. */
  return (
    <span className="inline-flex flex-col items-end gap-[3px] leading-none align-middle">
      {head}
      <span className="inline-flex items-baseline gap-1 font-mono text-[9px] leading-none tnum text-textSecondary whitespace-nowrap">
        {dte !== undefined && <span>{dte}d</span>}
        {dte !== undefined && (spot !== undefined || otmPct !== undefined) && <span aria-hidden>·</span>}
        {spot !== undefined && <span>spot ${spot.toFixed(2)}</span>}
        {spot !== undefined && otmPct !== undefined && <span aria-hidden>·</span>}
        {otmPct !== undefined && (
          <span>
            {otmPct >= 0 ? '+' : ''}
            {otmPct.toFixed(1)}%
          </span>
        )}
      </span>
    </span>
  );
};

export default ContractCell;
