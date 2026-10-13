/*
==================================================
  SLAYER TERMINAL - REVIEW · A REAL DAY COMING IN
  (components/review/RealDayDoor.tsx)

  A session on real days (2026-10-12) opens on Massive's
  record, and Massive answers five calls a minute. Until
  every call the desk needs is in, the desk is not drawn
  — never a moment of the house's tape under a real
  session's name. This card says what is being asked,
  where each call stands (asked, waiting its turn, in),
  and, when one cannot come, why and the door to ask
  again. With Massive not connected it says so, and the
  session waits as it is: nothing in it changes.

  Also the small words a desk on real days uses for a
  price it did not trade at: ≈, and why.
==================================================
*/

import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clock, Loader2, RotateCcw, X } from 'lucide-react';
import { card, head, headWord } from './DeskShell';
import { SayPage } from '../layout/PageMeta';
import { failWords, type RealSession } from '../../data/feed/backtest';
import type { Session } from '../../data/review/engine';
import type { Quote } from '../../data/review/quotes';
import { dayWords } from '../../data/review/tape';
import { marketClock } from '../../core/nyTime';

/** The mark a price wears when the contract did not trade at it */
export const EST = '≈';
export const isEst = (q: Pick<Quote, 'src'>): boolean => q.src === 'estimate' || q.src === 'coming';
export const estWords = (q: Pick<Quote, 'src'>): string =>
  q.src === 'coming' ? 'Estimated — its own trades are still coming in; nothing fills until they are' : 'No trade in it this minute: estimated from its last trade on the name’s real price — nothing fills on it';

const door = 'hit inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-borderSubtle font-mono text-[11px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors';

const RealDayDoor = ({ session, state }: { session: Session; state: RealSession }) => {
  const days = session.real?.days ?? [];
  const span = days.length ? `${dayWords(days[0], true)}${days.length > 1 ? ` to ${dayWords(days[days.length - 1], true)}` : ''}` : '';
  const done = state.steps.filter(s => s.state === 'done').length;
  return (
    <div className={`${card} max-w-[720px] mx-auto w-full`} data-review-desk={session.id} data-review-real={state.phase}>
      <SayPage words={session.name} />
      <div className={head}>
        <span className={headWord}>Real days</span>
        <span className="font-mono text-[11px] text-textMuted truncate">{session.name}</span>
      </div>
      <div className="px-5 py-5 flex flex-col gap-4">
        <p className="text-[13px] leading-snug text-textPrimary">
          This session replays the market’s own record from Massive — {span}: {(session.tickers?.length ?? 1) > 1 ? 'each name’s' : 'the name’s'} minutes, the contracts listed that day, and each contract’s own trades.
        </p>
        {state.phase === 'waiting' && (
          <p className="inline-flex items-center gap-2 text-[12px] text-textSecondary" data-real-phase="waiting">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-textMuted" aria-hidden="true" /> Asking where Massive stands…
          </p>
        )}
        {state.phase === 'off' && (
          <div className="flex flex-col gap-2" data-real-phase="off">
            <p className="text-[12px] text-warn">{failWords(state.standing)}.</p>
            <p className="text-[12px] leading-snug text-textSecondary">It opens once Massive is connected. Nothing in it has changed meanwhile — its trades are in the journal, its book is as you left it.</p>
          </div>
        )}
        {state.phase === 'short' && (
          <p className="text-[12px] leading-snug text-warn" data-real-phase="short">
            The record stops short on its first day — a half session, closed at {marketClock(13, 0)}. The desk’s day runs to the bell at {marketClock(16, 0)}; start a session on another day.
          </p>
        )}
        {(state.phase === 'loading' || state.phase === 'failed') && (
          <div className="flex flex-col gap-2" data-real-phase={state.phase}>
            <p className="text-[11px] text-textMuted">
              {done} of {state.steps.length} in · Massive answers five calls a minute, so a call may wait its turn
            </p>
            <ul className="flex flex-col gap-1.5">
              {state.steps.map(s => (
                <li key={s.key} className="flex items-center gap-2 text-[12px]" data-real-step={s.state}>
                  {s.state === 'done' ? (
                    <Check className="w-3.5 h-3.5 text-textSecondary shrink-0" aria-hidden="true" />
                  ) : s.state === 'failed' ? (
                    <X className="w-3.5 h-3.5 text-warn shrink-0" aria-hidden="true" />
                  ) : s.state === 'asking' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-textMuted shrink-0" aria-hidden="true" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-textMuted shrink-0" aria-hidden="true" />
                  )}
                  <span className={s.state === 'done' ? 'text-textSecondary' : 'text-textPrimary'}>{s.words}</span>
                  <span className="ml-auto font-mono text-[11px] text-textMuted whitespace-nowrap">
                    {s.state === 'done' ? 'in' : s.state === 'asking' ? 'asked' : s.state === 'waiting' ? 'waiting its turn' : s.state === 'failed' ? failWords(s.reason) : 'next'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {state.phase === 'failed' && (
            <button type="button" onClick={state.retry} className={door} data-real-retry>
              <RotateCcw className="w-3 h-3" /> Ask again
            </button>
          )}
          {state.phase === 'off' && (
            <Link to="/settings/sources" className={door}>
              Settings › Data sources <ArrowRight className="w-3 h-3" />
            </Link>
          )}
          <Link to="/practice/backtest" className={door}>
            Your sessions <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RealDayDoor;
