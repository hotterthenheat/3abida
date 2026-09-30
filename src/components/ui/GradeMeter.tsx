/*
==================================================
  SLAYER TERMINAL - THE FOUR WORDS, AS A METER
  (components/ui/GradeMeter.tsx)

  No score, grade or weight of ours reaches the screen
  (Noah, 2026-09-19: "poor, caution, and good instead
  of actual numbers", then "strong should be when its
  really great"). A figure of ours is SAID as one of
  four words — poor · caution · good · strong — and
  drawn as four steps filled up to the word that
  holds, in that word's ink: one step in red, two in
  orange, three in green, all four in green for
  STRONG. Four steps, never a position on a scale:
  that would be the figure again.

  It lived inside the stock page; the Tracker's
  "Confidence 92%" needed it too (2026-09-19), so it
  is shared. The word comes from the caller's own
  cuts (data/stockOverview.ts `gradeOf`, data/compass.ts
  `gradeOfConfidence`) — this only draws it.
==================================================
*/

import { GRADES, type Grade } from '../../data/stockOverview';

export const GRADE_INK: Record<Grade, string> = { strong: 'text-bull', good: 'text-bull', caution: 'text-warn', poor: 'text-bear' };
export const GRADE_FILL: Record<Grade, string> = { strong: 'bg-bull', good: 'bg-bull', caution: 'bg-warn', poor: 'bg-bear/80' };

/* `fill` — where the word grades HOW FAR A DIRECTION LEANS (the dark pool's posture), the steps wear the direction's ink, not
   the word's: a strong lean to SELLING in the four words' green would say the opposite of the word beside it. */
/* `thin` — 3px steps, for a grid cell: the lean cell's bar height, so a row carrying one stays the table's line. */
const GradeMeter = ({ grade, fill, thin = false, className = '' }: { grade: Grade; fill?: string; thin?: boolean; className?: string }) => {
  const upTo = GRADES.indexOf(grade);
  return (
    <span className={`flex gap-[3px] ${className}`} aria-hidden="true">
      {GRADES.map((g, i) => (
        <span key={g} className={`${thin ? 'h-[3px]' : 'h-[6px]'} flex-1 rounded-full transition-colors duration-500 ${i <= upTo ? (fill ?? GRADE_FILL[grade]) : 'bg-ink/[0.07]'}`} />
      ))}
    </span>
  );
};

export default GradeMeter;
