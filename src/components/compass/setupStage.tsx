/*
==================================================
  SLAYER TERMINAL - SETUP LIFECYCLE
  The verdict says what the engine thinks RIGHT NOW.
  This says how far along the setup actually is.

  "ACTIVE" was doing two jobs: a setup that merely
  qualified, and one where a target is printing this
  second. Those are not the same thing to look at,
  so they get their own words:

    FORMING — scoring, no trigger yet
    PRIMED  — qualified and working, nothing banked
    LIVE    — a take-profit has actually been hit
    FADED   — the thesis degraded, engine stepped aside

  LIVE keys off a target being HIT, not "in progress":
  the first target is in progress on essentially every
  open setup, so it separates nothing. A target that
  has been reached is the real event.

  Derived entirely from the verdict and the take-profit
  ladder we already carry — no new math, and the rank
  doubles as a sort key so the hottest float up.
==================================================
*/

import SignalBadge from '../ui/SignalBadge';
import type { Setup } from '../../types/compass';
import type { Tone } from '../ui/tones';

export type SetupStage = 'FORMING' | 'PRIMED' | 'LIVE' | 'FADED';

/* Labels are plain English — Noah on "PRIMED": "what in the world does primed
   even mean". Internal keys stay (they're the sort ranks and the API seam);
   only the printed word changes. LIVE prints as TARGET HIT because that is
   the literal event that promotes a setup there. */
export const STAGE_META: Record<SetupStage, { label: string; tone: Tone; rank: number; pulse: boolean; hint: string }> = {
  FADED: { label: 'FADED', tone: 'bear', rank: 0, pulse: false, hint: 'The thesis degraded — the engine has stepped aside' },
  FORMING: { label: 'BUILDING', tone: 'neutral', rank: 1, pulse: false, hint: 'Scoring, but no trigger has formed yet' },
  PRIMED: { label: 'WORKING', tone: 'neutral', rank: 2, pulse: false, hint: 'Qualified and working — no target reached yet' },
  // Generic fallback — callers that know WHICH rung banked pass hitLevel and
  // the badge prints "TP1 HIT" instead: same length, answers one more question
  // (and implies TP2+ is still ahead without saying a word more).
  LIVE: { label: 'TARGET HIT', tone: 'bull', rank: 3, pulse: true, hint: 'A take-profit has been hit — this one is paying' },
};

/** Highest banked rung, or null when nothing has hit. */
export function hitLevel(setup: Setup): number | null {
  const hits = setup.takeProfits.filter(tp => tp.status === 'HIT').map(tp => tp.level);
  return hits.length ? Math.max(...hits) : null;
}

/**
 * Where a setup sits in its life. `broken` lets a caller fold in a floor that
 * has given way (the slow scanners track that separately) without this module
 * needing to know how a level is judged.
 */
export function setupStage(setup: Setup, broken = false): SetupStage {
  if (broken || setup.verdict === 'EXIT') return 'FADED';
  if (setup.verdict === 'ENTER') {
    return setup.takeProfits.some(tp => tp.status === 'HIT') ? 'LIVE' : 'PRIMED';
  }
  return 'FORMING';
}

/** Lifecycle pill. Only LIVE pulses — the one stage that is happening now.

    PRIMED renders NOTHING by default. It is the modal state of every healthy
    board — Noah, seeing it on every card: "if every card has it does that
    mean no card should have it?" Exactly. A badge that is always there is
    noise; the exceptions (BUILDING, TARGET HIT, FADED) are the information.
    Tables that enumerate can opt back in with `showWorking` and get quiet
    muted text instead of a pill. */
const StageBadge = ({
  stage,
  dot = true,
  className = '',
  showWorking = false,
  hitLevel = null,
}: {
  stage: SetupStage;
  dot?: boolean;
  className?: string;
  showWorking?: boolean;
  /** Which rung banked — names the badge "TP1 HIT" instead of the generic */
  hitLevel?: number | null;
}) => {
  const meta = STAGE_META[stage];
  if (stage === 'PRIMED') {
    if (!showWorking) return null;
    return (
      <span title={meta.hint} className={`font-mono text-[10px] text-textMuted ${className}`}>
        working
      </span>
    );
  }
  const named = stage === 'LIVE' && hitLevel != null;
  return (
    <span title={named ? `Take-profit ${hitLevel} has been hit — this one is paying` : meta.hint} className="inline-flex">
      <SignalBadge tone={meta.tone} dot={dot} pulse={meta.pulse} className={className}>
        {named ? `TP${hitLevel} HIT` : meta.label}
      </SignalBadge>
    </span>
  );
};

export default StageBadge;
