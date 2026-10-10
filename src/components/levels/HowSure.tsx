/*
==================================================
  SLAYER TERMINAL - HOW SURE IS THIS
  (components/levels/HowSure.tsx)

  The ideas' rank 3, 2026-10-09: a quiet door beside
  a dealer level — "How sure" — that opens a small
  card with what the level stands on: the side the
  model assumes dealers are on, how fresh the open
  interest is, and where the level would sit if that
  side were the other way. data/levelSureness.ts
  makes the words; this only shows them, so any room
  can stand it beside its own levels (Pinpoint now,
  Terrain next).

    <HowSure sure={bookSureness(chain, spot, t)['call wall']} />
    <HowSure sure={…} variant="line" />   the assumption as a quiet line, the card on its door
==================================================
*/

import { Info } from 'lucide-react';
import PopoverCard from '../ui/PopoverCard';
import type { Sureness } from '../../data/levelSureness';

const fmt = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const NAME: Record<Sureness['level'], string> = { 'call wall': 'The call wall', 'put wall': 'The put wall', flip: 'The flip', supreme: 'The supreme' };

/** The card's body — also usable inline where a page has the room */
export const HowSureCard = ({ sure }: { sure: Sureness }) => (
  <div className="px-3 py-2.5 flex flex-col gap-2 text-[12px] leading-relaxed" data-how-sure-card={sure.level}>
    <p className="font-semibold text-textPrimary">
      How sure is {NAME[sure.level].toLowerCase()}
      {sure.strike != null ? ` at ${fmt(sure.strike)}` : ''}
    </p>
    <div>
      <p className="text-[11px] text-textMuted">What it assumes</p>
      <p className="text-textSecondary">{sure.assumption}</p>
    </div>
    <div>
      <p className="text-[11px] text-textMuted">How fresh</p>
      <p className="text-textSecondary">{sure.freshness}</p>
    </div>
    {sure.otherWords && (
      <div>
        <p className="text-[11px] text-textMuted">If the side were the other way</p>
        <p className="text-textSecondary">{sure.otherWords}</p>
      </div>
    )}
  </div>
);

interface HowSureProps {
  sure: Sureness;
  /** 'door' — a small "How sure" door (default); 'line' — the assumption as a quiet line, with the door after it */
  variant?: 'door' | 'line';
  align?: 'start' | 'end' | 'center';
  className?: string;
  /** The door as its icon alone (a grid cell) — its name stays for the keys and the pointer */
  compact?: boolean;
}

/** A quiet door beside a level that opens what it stands on */
const HowSure = ({ sure, variant = 'door', align = 'start', className = '', compact = false }: HowSureProps) => {
  const door = (
    <button
      type="button"
      aria-label={`How sure is ${NAME[sure.level].toLowerCase()}${sure.strike != null ? ` at ${fmt(sure.strike)}` : ''} — what it assumes, how fresh it is, and where it would sit the other way`}
      title="What this level assumes, how fresh it is, and where it would sit the other way"
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
      className={`hit shrink-0 inline-flex items-center gap-1 h-5 px-1 rounded text-[11px] text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] aria-expanded:text-textPrimary transition-colors ${className}`}
      data-how-sure={sure.level}
    >
      <Info className="w-3 h-3" />
      {!compact && 'How sure'}
    </button>
  );
  const card = (
    <PopoverCard trigger={door} width={320} align={align} testId={`how-sure-${sure.level}`}>
      <HowSureCard sure={sure} />
    </PopoverCard>
  );
  if (variant === 'door') return card;
  return (
    <p className="flex items-center gap-2 text-[11px] text-textMuted min-w-0" data-how-sure-line={sure.level}>
      <span className="min-w-0">{sure.assumption}</span>
      {card}
    </p>
  );
};

export default HowSure;
