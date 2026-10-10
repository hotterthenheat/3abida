/*
==================================================
  SLAYER TERMINAL - PAPER · AN EVALUATION, AT A GLANCE
  (components/paper/EvalStrip.tsx)

  A prop firm's dashboard, the four things a trader on
  an evaluation keeps an eye on, each with its own bar
  (the ideas of 2026-10-09):

    THE TARGET        what is made against what the plan
                      asks — raised where the best-day rule
                      would hold it back
    THE ROOM          what is left between the account and
                      its floor, of the whole allowance —
                      and the day's own room
    THE DAYS          trading days with a closed trade, of
                      those the plan needs — counted the
                      rules' way (engine.ts daysTradedOf: a
                      day with a close by the reader's hand,
                      a target, a stop or the bell; a close
                      the page made as it shut never counts)
    THE BEST DAY      the best day's share of the profit,
                      against the rule's cap

  Read from the engine's own read of the plan (engine.ts
  evalRead) — nothing here is a second rule book.
==================================================
*/

import type { ReactNode } from 'react';
import { card } from '../review/DeskShell';
import { dirInk, usd, usdSigned } from '../review/words';
import type { EvalRead, PaperAccount } from '../../data/paper/engine';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** One of the four: its name, the figure, the bar, a line under it */
const Meter = ({ label, value, share, ink, sub, testId }: { label: string; value: ReactNode; share: number; ink: string; sub: ReactNode; testId: string }) => (
  <div className="min-w-0 flex flex-col gap-1" data-eval-meter={testId}>
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-textMuted whitespace-nowrap">{label}</span>
      <span className="font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{value}</span>
    </div>
    <div className="relative h-[5px] rounded-full bg-ink/[0.08] overflow-hidden" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamp01(share) * 100)}>
      <span className={`absolute left-0 top-0 bottom-0 rounded-full ${ink}`} style={{ width: `${(clamp01(share) * 100).toFixed(1)}%` }} />
    </div>
    <div className="font-mono text-[11px] tnum text-textMuted truncate">{sub}</div>
  </div>
);

const EvalStrip = ({ account, ev }: { account: PaperAccount; ev: EvalRead }) => {
  const { plan } = ev;
  const need = ev.targetNeeded;
  const made = ev.profit;
  const raised = need > plan.target + 0.5;
  const roomShare = ev.room / plan.maxLoss;
  const tight = roomShare <= 0.25;
  const share = made > 0 ? ev.bestDay / made : 0;
  const cap = plan.bestDayShare;
  const over = cap != null && made > 0 && share > cap + 1e-9;
  const done = account.status !== 'open';
  return (
    <div className={`${card} px-4 py-3 grid gap-x-6 gap-y-3 grid-cols-2 lg:grid-cols-4`} data-paper-eval-strip={account.id}>
      <Meter
        label="To the target"
        testId="target"
        value={
          <>
            <span className={dirInk(made)}>{usdSigned(made, 0)}</span> <span className="text-textMuted">of {usd(need, 0)}</span>
          </>
        }
        share={made / need}
        ink="bg-bull/80"
        sub={done ? 'The evaluation is over' : ev.toTarget <= 0 && !raised ? 'At the target — it is judged at the day’s close' : raised ? `Raised from ${usd(plan.target, 0)} by the best-day rule` : `${usd(Math.max(0, need - made), 0)} to go`}
      />
      <Meter
        label="Room to the floor"
        testId="room"
        value={
          <>
            <span className={tight ? 'text-warn' : ''}>{usd(Math.max(0, ev.room), 0)}</span> <span className="text-textMuted">of {usd(plan.maxLoss, 0)}</span>
          </>
        }
        share={roomShare}
        ink={tight ? 'bg-warn' : 'bg-silver/80'}
        sub={ev.dayOver ? `The day is over — ${ev.dayOver}` : `${usd(Math.max(0, ev.dayRoom), 0)} left today · floor ${usd(ev.floor, 0)}${ev.floorStopped ? ', where it stays' : ''}`}
      />
      <Meter
        label="Trading days"
        testId="days"
        value={
          <>
            {ev.daysTraded} <span className="text-textMuted">of {plan.minDays}</span>
          </>
        }
        share={ev.daysTraded / plan.minDays}
        ink="bg-silver/80"
        sub={ev.daysTraded >= plan.minDays ? 'Enough days for the target to count' : 'A day counts once a trade closes on it'}
      />
      <Meter
        label="Best day’s share"
        testId="best-day"
        value={cap == null ? <span className="text-textMuted">no cap</span> : made > 0 ? <span className={over ? 'text-warn' : ''}>{Math.round(share * 100)}%</span> : <span className="text-textMuted">—</span>}
        share={cap == null ? 0 : share}
        ink={over ? 'bg-warn' : 'bg-silver/80'}
        sub={cap == null ? 'This plan has no best-day rule' : made > 0 ? `Best day ${usd(ev.bestDay, 0)} · the plan’s cap is ${Math.round(cap * 100)}%` : `Nothing made yet · the plan’s cap is ${Math.round(cap * 100)}%`}
      />
    </div>
  );
};

export default EvalStrip;
