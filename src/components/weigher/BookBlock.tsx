/*
==================================================
  SLAYER TERMINAL - THE BOOK AT THIS STRIKE
  (components/weigher/BookBlock.tsx)

  The third block of the chain's weigh-up, under
  Stats and The Greeks, in their exact grammar: what
  the dealer book says about the strike the reader
  is weighing (data/bookAtStrike.ts). Our two cents,
  where the decision is made (Noah, 2026-09-28).
==================================================
*/

import { StatCell, fmtStrike } from './ChainGrid';
import { changeWords, type BookAtStrike } from '../../data/bookAtStrike';
import { fmtDollars } from '../../data/ahead';
import { SHAPE_SAYS, SHAPE_WORD } from '../../data/mapShape';
import type { DeskContract } from '../../data/weigherDesk';

/** The shape as the Map's chip — WALL firmer, the rest quiet */
export const ShapeChip = ({ shape }: { shape: NonNullable<BookAtStrike['shape']> }) => (
  <span
    className={`inline-flex items-center h-[14px] px-1 rounded-[3px] border font-mono text-[7.5px] font-bold uppercase tracking-[0.14em] leading-none whitespace-nowrap ${shape === 'wall' ? 'border-textSecondary/60 text-textPrimary' : 'border-borderSubtle text-textMuted'}`}
    title={SHAPE_SAYS[shape]}
    data-book-shape={shape}
  >
    {SHAPE_WORD[shape]}
  </span>
);

const BookBlock = ({ read, c }: { read: BookAtStrike | null; c: DeskContract }) => {
  if (!read) return null;
  const part = read.role ? read.role : `${Math.abs(read.flipDistPct).toFixed(1)}% ${read.flipDistPct >= 0 ? 'above' : 'below'} the flip`;
  const partInk = read.role === 'call wall' ? 'text-bull' : read.role === 'put wall' ? 'text-bear' : read.role === 'supreme' ? 'text-supreme' : undefined;
  /* held + broke = the tests; the count of visits is implied so the cell keeps to one line */
  const held = read.held ? (read.held.tests === 0 ? 'not reached today' : `held ${read.held.held} · broke ${read.held.broke}`) : '—';
  /* the odds the contract wants: a call wants the print at or above the strike, a put at or below */
  const odds = c.right === 'C' ? read.oddsAbove : read.oddsBelow;
  const change = changeWords(read.change);
  return (
    <div className="flex flex-col gap-2" data-book-block={read.strike}>
      <span className="inline-flex items-center gap-2">
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-textSecondary">The book at {fmtStrike(read.strike)}</span>
        {read.shape && <ShapeChip shape={read.shape} />}
      </span>
      {/* three across, two rows: these cells hold WORDS (Stats' five-across holds figures) — five across ran the words into
          each other inside the chain's card at 1440 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2.5">
        <StatCell label="Dealer gamma" term="GEX" value={`${read.net >= 0 ? '+' : '−'}${fmtDollars(Math.abs(read.net))}`} ink={read.net < 0 ? 'text-bull' : 'text-bear'} />
        <StatCell label="A move through it" value={read.lean === 'push back' ? 'dealers push back' : 'dealers push it along'} ink={read.lean === 'push back' ? 'text-bull' : 'text-bear'} />
        <StatCell label="Its part today" value={part} ink={partInk} />
        <StatCell label="Held today" value={held} />
        <StatCell label={c.right === 'C' ? 'Closes at or above' : 'Closes at or below'} term="Close odds" value={odds == null ? '—' : `${odds.toFixed(0)}%`} />
        <StatCell label="Since the open" value={change} ink={read.change?.verdict === 'building' ? 'text-bull' : read.change?.verdict === 'draining' ? 'text-bear' : undefined} />
      </div>
    </div>
  );
};

export default BookBlock;
