/*
==================================================
  SLAYER TERMINAL - THE ACCOUNT PANEL
  (pages/paper/AccountPanel.tsx)

  WHAT A TRADING ACCOUNT PANEL IS FOR, reasoned out
  rather than copied — the research came back with
  nothing on prop firm dashboards that survived
  checking, so this is argued from what the reader
  actually needs, and the argument is written down
  so it can be disagreed with.

  A trader looks here to answer three questions, in
  this order, and the panel is built in that order:

    1. CAN I TRADE RIGHT NOW?  A desk that has
       stopped taking orders must say so before it
       says anything else. A number is no use if
       the next click is going to be refused.

    2. HOW MUCH ROOM HAVE I GOT?  This is the one
       that decides the size of the next trade, and
       IT IS NOT ALWAYS THE EQUITY. In an
       evaluation the equity is not the binding
       constraint — the trailing floor is. A
       hundred thousand dollar account with two
       thousand left to the floor is a two thousand
       dollar account, and printing $100,000 big
       and "2,000 left" small has the hierarchy
       exactly backwards. So the hero INVERTS by
       mode: on a normal desk it is the equity, in
       an evaluation it is the room to the floor.

    3. WHAT HAPPENED TODAY?  The day's P&L, which
       is the number a reader checks against their
       own plan.

  The balance sheet comes last and small, because
  it is looked up rather than watched.

  WHAT THIS PANEL IS NOT: a profile card. It used
  to open with an avatar, a handle and a plan
  badge, which is SaaS chrome on a trading desk.
  What belongs at the top of an account panel is
  WHICH ACCOUNT, not who you are — you know who you
  are. The desk's mode IS the account here, so the
  head is an account selector.

  Every figure is the engine's own read
  (readAccount) — nothing here computes a balance,
  and the two hands at the foot go through the same
  doors every other one uses.
==================================================
*/

import { useState } from 'react';
import { ChevronDown, Lock, Power, RotateCcw } from 'lucide-react';
import { fmtMoney } from '../../core/paper/instruments';
import { flattenAll, isLive, readAccount, resetAccount, usePaper } from '../../core/paper/engine';
import { MODE_WORDS, useModes } from '../../core/paper/modes';
import { readProp, usePropState } from '../../core/paper/propFirm';
import { tiltLocked, useTilt } from '../../core/paper/tilt';
import { Money, Stat, T } from './paperKit';

const AccountPanel = () => {
  const paper = usePaper();
  const modes = useModes();
  const prop = usePropState();
  const tilt = useTilt();
  const acct = readAccount(paper);
  const [armed, setArmed] = useState(false);
  const [open, setOpen] = useState(true);

  const opens = paper.positions.filter(p => p.qty !== 0).length;
  const working = paper.orders.filter(isLive).length;
  const dayPct = paper.account.dayStartEquity ? (acct.dayPnl / paper.account.dayStartEquity) * 100 : 0;
  const lockWords = prop.locked?.reason ?? (tiltLocked() ? (tilt.lockReason ?? 'a cool-off is running') : null);
  const evaluation = modes.mode === 'prop' ? readProp() : null;

  /* THE NUMBER THAT DECIDES THE NEXT TRADE. In an evaluation that is the room
     to the floor, everywhere else it is what the account is worth. */
  const hero = evaluation
    ? { label: evaluation.kind === 'intraday' ? 'Room to the trailing floor' : 'Room to the floor', value: Math.max(0, evaluation.room), money: true }
    : { label: 'Equity', value: acct.equity, money: true };
  const heroInk = evaluation
    ? evaluation.used > 0.75
      ? 'rgb(var(--bear))'
      : evaluation.used > 0.45
        ? 'rgb(var(--warn))'
        : 'rgb(var(--text-primary))'
    : 'rgb(var(--text-primary))';

  return (
    <section className="shrink-0 border-b border-borderSubtle/70" data-paper-account-panel>
      {/* ---- 0. WHICH ACCOUNT ---- */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-borderSubtle/70">
        <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-warn border border-warn/60 rounded px-1.5 py-0.5 select-none" title="Paper trading — simulated orders against the live market state. Nothing here reaches a brokerage.">
          Paper
        </span>
        <span className="font-mono text-[11px] font-semibold text-textPrimary truncate" title={MODE_WORDS[modes.mode].blurb} data-account-mode={modes.mode}>
          {MODE_WORDS[modes.mode].label}
        </span>
        {evaluation && (
          <span className={T.label} title="Which drawdown this evaluation runs">
            {evaluation.kind === 'intraday' ? 'Trailing' : 'End of day'}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-label={open ? 'Hide the account' : 'Show the account'}
          className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.08] transition-colors"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
      </div>

      {/* ---- 1. CAN I TRADE? said before any number ---- */}
      {lockWords && (
        <div className="flex items-start gap-1.5 px-3 py-2 bg-bear/[0.1] border-b border-bear/30" data-account-locked>
          <Lock className="w-3 h-3 mt-px shrink-0 text-bear" aria-hidden />
          <span className="font-mono text-[10px] leading-snug text-bear">
            <span className="font-bold uppercase tracking-wider">Not taking orders</span> — {lockWords}. Closing a position is still allowed.
          </span>
        </div>
      )}

      {open && (
        <>
          {/* ---- 2. THE ROOM ---- */}
          <div className="px-3 pt-3 pb-2">
            <span className={T.label}>{hero.label}</span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className="font-mono text-[26px] font-semibold tnum leading-none"
                style={{ color: heroInk }}
                data-account-hero
                /* the equity is the hero everywhere but an evaluation, where it
                   drops a tier — so the hook follows it rather than the slot */
                {...(evaluation ? {} : { 'data-account-equity': '' })}
              >
                {fmtMoney(hero.value, false)}
              </span>
              {evaluation && (
                <span className={T.sub} title="The whole allowance this evaluation gives you">
                  of {fmtMoney(evaluation.limit, false)}
                </span>
              )}
            </div>

            {/* WHERE THE ACCOUNT SITS BETWEEN THE FLOOR AND THE PEAK. A percentage
                bar says how much is gone; this says where you ARE, which is what
                a trailing drawdown makes hard to hold in your head. */}
            {evaluation && (
              <FloorTrack read={evaluation} />
            )}

            {/* margin is the everyday version of the same question */}
            {!evaluation && acct.marginUsed > 0 && (
              <div className="mt-2">
                <div className="h-1 rounded-full bg-ink/[0.08] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${Math.round(Math.min(1, acct.marginUsed / Math.max(1, acct.marginUsed + acct.buyingPower)) * 100)}%`,
                      background: 'rgb(var(--silver))',
                    }}
                  />
                </div>
                <p className={`${T.note} mt-1`}>
                  {fmtMoney(acct.marginUsed, false)} of your {fmtMoney(acct.marginUsed + acct.buyingPower, false)} is held against open positions
                </p>
              </div>
            )}
          </div>

          {/* ---- 3. TODAY ---- */}
          <div className="px-3 pb-3 grid grid-cols-2 gap-x-3">
            <Stat label="Today" testId="day">
              <span className="inline-flex items-baseline gap-1.5" data-account-day>
                <Money v={acct.dayPnl} className="text-[13px] font-semibold" />
                <span className={`font-mono text-[10px] tnum ${acct.dayPnl > 0 ? 'text-bull' : acct.dayPnl < 0 ? 'text-bear' : 'text-textMuted'}`}>
                  {acct.dayPnl >= 0 ? '+' : ''}
                  {dayPct.toFixed(2)}%
                </span>
              </span>
            </Stat>
            <Stat label={evaluation ? 'Equity' : 'All time'} testId={evaluation ? 'equity' : 'total'}>
              {evaluation ? <span data-account-equity>{fmtMoney(acct.equity, false)}</span> : <Money v={acct.totalPnl} className="text-[13px] font-semibold" />}
            </Stat>
            {evaluation && evaluation.dayRoom != null && (
              <Stat
                label="Left today"
                testId="dayroom"
                title="This evaluation also caps what a single day may lose"
                className="col-span-2 pt-1"
              >
                <span style={{ color: evaluation.dayRoom < evaluation.room * 0.5 ? 'rgb(var(--warn))' : undefined }}>{fmtMoney(Math.max(0, evaluation.dayRoom), false)}</span>
              </Stat>
            )}
          </div>

          {/* ---- 4. THE LEDGER, looked up rather than watched ---- */}
          <div className="px-3 pb-3 grid grid-cols-3 gap-x-2 gap-y-2.5 border-t border-borderSubtle/70 pt-2.5">
            <Cell k="cash" label="Cash">{fmtMoney(acct.cash, false)}</Cell>
            <Cell
              k="bp"
              label="Buying power"
              title={paper.account.bpMultiple && paper.account.bpMultiple !== 1 ? `${paper.account.bpMultiple}× the account — Free Rein` : 'Equity less the margin held'}
            >
              {fmtMoney(acct.buyingPower, false)}
            </Cell>
            <Cell k="margin" label="Margin">{fmtMoney(acct.marginUsed, false)}</Cell>
            <Cell k="open" label="Open">{opens === 0 ? '—' : `${opens} · ${working} working`}</Cell>
            <Cell k="realized" label="Realized"><Money v={paper.account.realizedTotal} className="text-[11px]" /></Cell>
            <Cell k="fees" label="Fees">{fmtMoney(-Math.abs(paper.account.feesTotal))}</Cell>
          </div>

          {/* ---- the two hands on the account itself ---- */}
          <div className="px-3 pb-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => flattenAll('panel', 'flatten from the account')}
              disabled={opens === 0 && working === 0}
              title="Close every position and cancel every working order"
              data-account-flatten
              className="inline-flex items-center gap-1 h-6 px-2 rounded border border-borderSubtle font-mono text-[9px] uppercase tracking-widest text-textSecondary hover:text-bear hover:border-bear/50 disabled:hover:text-textSecondary disabled:hover:border-borderSubtle transition-colors"
            >
              <Power className="w-3 h-3" /> Flatten
            </button>
            <button
              type="button"
              onClick={() => {
                if (!armed) {
                  setArmed(true);
                  return;
                }
                resetAccount();
                setArmed(false);
              }}
              onBlur={() => setArmed(false)}
              title="Start the paper account over"
              data-account-reset
              className={`ml-auto inline-flex items-center gap-1 h-6 px-2 rounded border font-mono text-[9px] uppercase tracking-widest transition-colors ${
                armed ? 'border-bear text-bear bg-bear/[0.08]' : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'
              }`}
            >
              <RotateCcw className="w-3 h-3" /> {armed ? 'Yes, reset' : 'Reset'}
            </button>
          </div>
        </>
      )}
    </section>
  );
};

/**
 * THE FLOOR, THE PEAK, AND WHERE YOU ARE BETWEEN THEM.
 *
 * A trailing drawdown is hard to hold in your head because the floor MOVES:
 * every new high drags it up behind you, so the allowance is a band that
 * slides rather than a balance that falls. A percentage-filled bar says how
 * much is gone and nothing about where the edges are. This draws the band
 * with both edges priced, the account's own mark on it, and the day's floor
 * where the evaluation sets one — so the reader can see a floor coming up
 * underneath them, which is the thing that actually ends accounts.
 */
const FloorTrack = ({ read }: { read: ReturnType<typeof readProp> }) => {
  const lo = read.floor;
  const hi = Math.max(read.peak, read.equity);
  const span = hi - lo;
  const at = (v: number) => (span > 0 ? Math.min(100, Math.max(0, ((v - lo) / span) * 100)) : 0);
  const danger = read.used > 0.75;
  return (
    <div className="mt-2.5" data-account-prop>
      <div className="relative h-1.5 rounded-full bg-ink/[0.1] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{ width: `${at(read.equity)}%`, background: danger ? 'rgb(var(--bear))' : read.used > 0.45 ? 'rgb(var(--warn))' : 'rgb(var(--bull))' }}
        />
        {read.dayFloor != null && read.dayFloor > lo && read.dayFloor < hi && (
          <span className="absolute inset-y-0 w-px bg-warn" style={{ left: `${at(read.dayFloor)}%` }} title={`The day's own floor sits at ${fmtMoney(read.dayFloor, false)}`} aria-hidden />
        )}
        {read.target != null && read.target > lo && read.target < hi && (
          <span className="absolute inset-y-0 w-px bg-silver" style={{ left: `${at(read.target)}%` }} title={`The profit target is ${fmtMoney(read.target, false)}`} aria-hidden />
        )}
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="font-mono text-[9px] tnum text-bear" title="Touch this and the evaluation is over">
          {fmtMoney(lo, false)}
        </span>
        <span className="font-mono text-[9px] tnum text-textMuted" title={read.kind === 'intraday' ? 'The high-water mark the floor trails' : "Yesterday's close, which this floor is measured from"}>
          {fmtMoney(read.peak, false)}
        </span>
      </div>
    </div>
  );
};

const Cell = ({ label, children, title, k }: { label: string; children: React.ReactNode; title?: string; k: string }) => (
  <div className="flex flex-col gap-1 min-w-0" title={title} data-account-cell={k}>
    <span className="font-mono text-[8px] uppercase tracking-widest text-textMuted whitespace-nowrap truncate">{label}</span>
    <span className="font-mono text-[11px] tnum text-textPrimary whitespace-nowrap truncate">{children}</span>
  </div>
);

export default AccountPanel;
