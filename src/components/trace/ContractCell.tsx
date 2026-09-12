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
*/

import { DOOR, DOOR_GROUP_TEXT } from './door';

/* The COLUMN is right-aligned (header included), so header and endings share
   one edge and read as one parent — the cell itself just hugs its content.
   Hover: the line fills, the strike takes silver; the call/put word keeps
   its own ink — that colour is information, not chrome. */
const ContractCell = ({ strike, right, expiry }: { strike: number; right: 'C' | 'P'; expiry: string }) => (
  <span className={`group/door inline-flex items-baseline gap-1.5 pb-[2px] ${DOOR}`}>
    <span className={`font-mono text-xs font-bold text-textPrimary tnum ${DOOR_GROUP_TEXT}`}>{strike}</span>
    <span className={`font-mono text-[11px] font-semibold ${right === 'C' ? 'text-bull' : 'text-bear'}`}>
      {right === 'C' ? 'call' : 'put'}
    </span>
    <span className="font-mono text-[10px] text-textMuted tnum">{expiry}</span>
  </span>
);

export default ContractCell;
