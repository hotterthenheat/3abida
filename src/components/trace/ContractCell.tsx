/*
  THE contract cell (Noah, 2026-08-30, rounds 1+2): it speaks WORDS, never
  abbreviations — "call" and "put" in their own ink, the C/P letter chips
  are dead; every cell ENDS ON THE SAME POINT — one fixed shape, right-
  aligned, a short strike starts later but finishes exactly where the long
  ones do; and the click affordance was a SIMPLE LINE under each one (the
  pill-with-hover read awkward — Noah killed it same day), white after the
  moon blue it launched with (2026-08-30: "make all of my blue underlines
  white"), then GONE (2026-09-16: "the con that shows a white underline, I
  want it gone for them all but keep the holo silver hover effect") — the
  silver hover alone is the door now, on every Trace page (see door.ts).
*/

import { DOOR, DOOR_GROUP_TEXT } from './door';

/* The COLUMN is right-aligned (header included), so header and endings share
   one edge and read as one parent — the cell itself just hugs its content.
   Hover: ALL THREE take silver — the strike, the call/put word and the date
   (Noah, 2026-09-16: "all three things in the con should have the holo
   silver hover"); the side's ink returns as the pointer leaves. The 2px
   under it stays: it held the line, and it keeps every door 21px in its
   39px row. */
const ContractCell = ({ strike, right, expiry }: { strike: number; right: 'C' | 'P'; expiry: string }) => (
  <span className={`group/door inline-flex items-baseline gap-1.5 pb-[2px] ${DOOR}`}>
    <span className={`font-mono text-xs font-bold text-textPrimary tnum ${DOOR_GROUP_TEXT}`}>{strike}</span>
    <span className={`font-mono text-[11px] font-semibold ${right === 'C' ? 'text-bull' : 'text-bear'} ${DOOR_GROUP_TEXT}`}>
      {right === 'C' ? 'call' : 'put'}
    </span>
    <span className={`font-mono text-[10px] text-textMuted tnum ${DOOR_GROUP_TEXT}`}>{expiry}</span>
  </span>
);

export default ContractCell;
