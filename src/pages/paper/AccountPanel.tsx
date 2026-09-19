/*
==================================================
  SLAYER TERMINAL - THE ACCOUNT PANEL
  (pages/paper/AccountPanel.tsx)

  WHOSE DESK THIS IS, and what it is worth. The
  reader, the account they are trading and the
  mode it runs under, over one big equity figure
  with the day under it and the rest of the
  balance sheet in a grid.

  It is where the shell's header used to carry six
  bare numbers strung across the top of the page.
  An account is not a caption: it belongs beside
  the ticket that spends it, on the same rail, in
  one card the eye can land on.

  Every figure is the engine's own read
  (readAccount) — nothing here computes a balance,
  and the two buttons at the foot go through the
  same doors every other hand uses.
==================================================
*/

import { useState } from 'react';
import { ChevronDown, Power, RotateCcw } from 'lucide-react';
import { Avatar } from '../../components/community/PostCard';
import { useAccount } from '../../data/account';
import { fmtMoney } from '../../core/paper/instruments';
import { flattenAll, isLive, readAccount, resetAccount, usePaper } from '../../core/paper/engine';
import { MODE_WORDS, useModes } from '../../core/paper/modes';
import { readProp, usePropState } from '../../core/paper/propFirm';
import { tiltLocked, useTilt } from '../../core/paper/tilt';
import { Money, PaperPill } from './paperKit';

const Cell = ({ label, children, title, k }: { label: string; children: React.ReactNode; title?: string; k: string }) => (
  <div className="flex flex-col gap-0.5 min-w-0" title={title} data-account-cell={k}>
    <span className="font-mono text-[8px] uppercase tracking-widest text-textMuted whitespace-nowrap">{label}</span>
    <span className="font-mono text-[11px] tnum text-textPrimary whitespace-nowrap truncate">{children}</span>
  </div>
);

const AccountPanel = () => {
  const who = useAccount();
  const paper = usePaper();
  const modes = useModes();
  const prop = usePropState();
  const tilt = useTilt();
  const acct = readAccount(paper);
  const [armed, setArmed] = useState(false);
  const [open, setOpen] = useState(true);

  const open_ = paper.positions.filter(p => p.qty !== 0).length;
  const working = paper.orders.filter(isLive).length;
  const fees = paper.account.feesTotal;
  const realized = paper.account.realizedTotal;
  const dayPct = paper.account.dayStartEquity ? (acct.dayPnl / paper.account.dayStartEquity) * 100 : 0;
  const locked = prop.locked != null || tiltLocked();
  const propRead = modes.mode === 'prop' ? readProp() : null;

  return (
    <section className="shrink-0 border-b border-borderSubtle/70" data-paper-account-panel>
      {/* who, and what they are running */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <Avatar handle={who.handle} size={26} />
        <span className="flex flex-col min-w-0 leading-none gap-0.5">
          <span className="font-semibold text-[12px] text-textPrimary truncate">{who.name}</span>
          <span className="font-mono text-[9px] text-textMuted truncate">@{who.handle} · {who.plan}</span>
        </span>
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

      {/* the account, the mode, and whether it is taking orders */}
      <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap">
        <PaperPill />
        <span
          className={`font-mono text-[9px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 border ${
            modes.mode === 'prop' ? 'text-warn border-warn/50' : modes.mode === 'free' ? 'text-silver border-silver/40' : 'text-textSecondary border-borderMuted'
          }`}
          title={MODE_WORDS[modes.mode].blurb}
          data-account-mode={modes.mode}
        >
          {MODE_WORDS[modes.mode].label}
        </span>
        {locked && (
          <span className="font-mono text-[9px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 border border-bear/60 text-bear" title={prop.locked?.reason ?? tilt.lockReason ?? 'The desk is not taking new orders'}>
            Locked
          </span>
        )}
      </div>

      {open && (
        <>
          {/* what it is worth */}
          <div className="px-3 pb-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[20px] font-semibold tnum text-textPrimary leading-none" data-account-equity>
                {fmtMoney(acct.equity, false)}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">equity</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5" data-account-day>
              <Money v={acct.dayPnl} className="text-[12px] font-semibold" />
              <span className={`font-mono text-[10px] tnum ${acct.dayPnl > 0 ? 'text-bull' : acct.dayPnl < 0 ? 'text-bear' : 'text-textMuted'}`}>
                {acct.dayPnl >= 0 ? '+' : ''}{dayPct.toFixed(2)}%
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">today</span>
              <span className="ml-auto font-mono text-[9px] text-textMuted">
                all time <Money v={acct.totalPnl} className="text-[10px]" />
              </span>
            </div>
          </div>

          {/* the balance sheet */}
          <div className="px-3 pb-2 grid grid-cols-3 gap-x-2 gap-y-2">
            <Cell k="cash" label="Cash">{fmtMoney(acct.cash, false)}</Cell>
            <Cell k="bp" label="Buying power" title={paper.account.bpMultiple && paper.account.bpMultiple !== 1 ? `${paper.account.bpMultiple}× the account — Free Rein` : 'Equity less the margin held'}>
              {fmtMoney(acct.buyingPower, false)}
            </Cell>
            <Cell k="margin" label="Margin">{fmtMoney(acct.marginUsed, false)}</Cell>
            <Cell k="open" label="Open">{open_ === 0 ? '—' : `${open_} · ${working} working`}</Cell>
            <Cell k="realized" label="Realized"><Money v={realized} className="text-[11px]" /></Cell>
            <Cell k="fees" label="Fees">{fmtMoney(-Math.abs(fees))}</Cell>
          </div>

          {/* the evaluation's own line, when one is being run */}
          {propRead && (
            <div className="px-3 pb-2" data-account-prop>
              <div className="flex items-baseline justify-between font-mono text-[9px] uppercase tracking-widest text-textMuted">
                <span>Drawdown room</span>
                <span className="tnum normal-case tracking-normal text-[10px]" style={{ color: propRead.used > 0.75 ? 'rgb(var(--bear))' : 'rgb(var(--text-primary))' }}>
                  {fmtMoney(Math.max(0, propRead.room), false)} of {fmtMoney(propRead.limit, false)}
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-ink/[0.08] overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${Math.round(Math.min(1, Math.max(0, propRead.used)) * 100)}%`, background: propRead.used > 0.75 ? 'rgb(var(--bear))' : propRead.used > 0.45 ? 'rgb(var(--warn))' : 'rgb(var(--bull))' }}
                />
              </div>
            </div>
          )}

          {/* the two hands on the account itself */}
          <div className="px-3 pb-2.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => flattenAll('panel', 'flatten from the account')}
              disabled={open_ === 0 && working === 0}
              title="Close every position and cancel every working order"
              data-account-flatten
              className="inline-flex items-center gap-1 h-6 px-2 rounded border border-borderSubtle font-mono text-[9px] uppercase tracking-widest text-textSecondary hover:text-bear hover:border-bear/50 disabled:opacity-35 disabled:hover:text-textSecondary disabled:hover:border-borderSubtle transition-colors"
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

export default AccountPanel;
