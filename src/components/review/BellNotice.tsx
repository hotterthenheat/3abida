/*
==================================================
  SLAYER TERMINAL - REVIEW · THE BELL
  (components/review/BellNotice.tsx)

  Contracts trade 09:30 to 16:00 New York and then the
  market is SHUT — there is no overnight session to
  trade into, the way a future has (Noah, 2026-09-20:
  "there should be some sort of alert telling the user
  that the options day is over because unlike futures
  they have a closing window"). A replay that simply
  stops at 16:00 leaves the reader pressing play at a
  clock that will not move. So the desk says it, twice:

    THE LAST FIFTEEN MINUTES — one quiet line over the
    tape: how long is left, and, when a held contract
    expires TODAY, that it will settle at the bell
    (what it is worth in the money — often nothing).

    THE BELL — a card: the day is over, what the bell
    did to the book (day orders that went unfilled,
    contracts that settled, positions that carry over
    and will open wherever the name gaps to), and the
    one thing there is to do next: open the next day.

  It floats at the head of the tape, in the chart's own
  clothes, and both can be put away (they come back
  with the next day's close). Not an ALERT in the house
  sense — nothing was set, nothing rings: it is the
  state of the market, said where the eye is.
==================================================
*/

import { ArrowRight, BellRing, X } from 'lucide-react';
import { usdSigned } from './words';

export interface BellFacts {
  /** "Mon, Jun 22" */
  dayWords: string;
  /** Day orders that went unfilled and were cancelled at 16:00 */
  dayOrders: number;
  /** Contracts that expired today: their words, what a share settled at, what the trade made or lost */
  settled: { contract: string; price: number; pnl: number | null }[];
  /** Positions still open — they carry over */
  carried: number;
  /** Working orders that carry over with them */
  working: number;
}

interface ClosingProps {
  minutesLeft: number;
  /** Held contracts that expire today, in words */
  expiring: string[];
  onDismiss: () => void;
}

const shell = 'pointer-events-auto rounded-md border bg-panel shadow-[0_8px_28px_rgba(0,0,0,0.4)] animate-soft-in';
const closeDoor = 'inline-flex items-center justify-center w-5 h-5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.08] transition-colors';

/** The last fifteen minutes: one line */
export const ClosingLine = ({ minutesLeft, expiring, onDismiss }: ClosingProps) => (
  <div className={`${shell} border-warn/40 h-7 pl-2.5 pr-1 inline-flex items-center gap-2 font-mono text-[10px] whitespace-nowrap`} role="status" data-chart-chrome data-review-closing={minutesLeft}>
    <BellRing className="w-3 h-3 text-warn" aria-hidden="true" />
    <span className="font-semibold text-textPrimary">
      {minutesLeft} {minutesLeft === 1 ? 'minute' : 'minutes'} to the bell
    </span>
    <span className="text-textMuted">the market shuts at 16:00 New York</span>
    {expiring.length > 0 && (
      <span className="text-warn">
        · {expiring.length === 1 ? expiring[0] : `${expiring.length} contracts`} {expiring.length === 1 ? 'expires' : 'expire'} today — settled at the bell
      </span>
    )}
    <button type="button" onClick={onDismiss} title="Put this away" aria-label="Put this away" className={closeDoor}>
      <X className="w-3 h-3" />
    </button>
  </div>
);

interface BellProps {
  facts: BellFacts;
  /** Null on the tape's last day */
  onNextDay: (() => void) | null;
  onDismiss: () => void;
}

/** 16:00: the day is over */
export const BellCard = ({ facts, onNextDay, onDismiss }: BellProps) => (
  <div className={`${shell} border-borderMuted w-[min(420px,calc(100vw-48px))] px-3.5 pt-2.5 pb-3`} role="status" aria-live="polite" data-chart-chrome data-review-bell>
    <div className="flex items-center gap-2">
      <BellRing className="w-3.5 h-3.5 text-silver" aria-hidden="true" />
      <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-textPrimary">The bell · 16:00 New York</span>
      <button type="button" onClick={onDismiss} title="Put this away" aria-label="Put this away" className={`${closeDoor} ml-auto`}>
        <X className="w-3 h-3" />
      </button>
    </div>
    <p className="mt-1.5 text-[12px] leading-snug text-textPrimary">{facts.dayWords}’s market is shut.</p>
    <p className="mt-0.5 text-[11px] leading-snug text-textSecondary">Contracts trade 09:30 to 16:00 — nothing can be bought or sold at the market until the next open. A limit or a stop left now waits for it.</p>
    {(facts.dayOrders > 0 || facts.settled.length > 0 || facts.carried > 0) && (
      <ul className="mt-2 pt-2 border-t border-borderSubtle/70 flex flex-col gap-1 font-mono text-[10px] text-textSecondary">
        {facts.settled.map(s => (
          <li key={s.contract} className="flex items-baseline gap-1.5">
            <span className="text-textPrimary">{s.contract}</span> expired — settled at {s.price.toFixed(2)} a share
            {s.pnl != null && <span className={`ml-auto font-semibold ${s.pnl >= 0 ? 'text-bull' : 'text-bear'}`}>{usdSigned(s.pnl)}</span>}
          </li>
        ))}
        {facts.dayOrders > 0 && (
          <li>
            {facts.dayOrders} day {facts.dayOrders === 1 ? 'order' : 'orders'} went unfilled and {facts.dayOrders === 1 ? 'was' : 'were'} cancelled
          </li>
        )}
        {facts.carried > 0 && (
          <li>
            {facts.carried} {facts.carried === 1 ? 'position carries' : 'positions carry'} over{facts.working > 0 ? ` with ${facts.working} working ${facts.working === 1 ? 'order' : 'orders'}` : ''} — {facts.carried === 1 ? 'it opens' : 'they open'} wherever the name gaps to
          </li>
        )}
      </ul>
    )}
    <div className="mt-2.5 flex items-center gap-2">
      {onNextDay ? (
        <button type="button" onClick={onNextDay} className="inline-flex items-center gap-1.5 h-7 px-3.5 rounded-full text-[11px] font-semibold transition-opacity hover:opacity-90" style={{ background: 'rgb(var(--silver-fill))', color: 'rgb(var(--night))' }} data-review-bell-next>
          Open the next day <ArrowRight className="w-3 h-3" />
        </button>
      ) : (
        <span className="font-mono text-[10px] text-textMuted">This is the tape’s last day.</span>
      )}
    </div>
  </div>
);
