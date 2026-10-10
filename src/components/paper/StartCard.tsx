/*
  PAPER · BEFORE THERE IS AN ACCOUNT — the Live Chart's first face: a practice account of the size chosen, or an evaluation
  on a plan, started right here (the Evaluation page that used to hold the plans was taken out on 2026-09-22). Plain words
  about what the prices are, since the reader is about to trust them.
*/

import { ClipboardCheck, Wallet } from 'lucide-react';
import { card } from '../review/DeskShell';
import { usd } from '../review/words';
import { PRACTICE_SIZES, type EvalPlan } from '../../data/paper/engine';
import { EMBEDDED } from '../../embed';
import PlanRows from './PlanRows';

const StartCard = ({ onPractice, onEvaluation, canStart }: { onPractice: (size: number) => void; onEvaluation: (plan: EvalPlan) => void; canStart: boolean }) => (
  <div className="grid gap-2.5 lg:grid-cols-2" data-paper-start>
    <div className={`${card} px-6 py-5 flex flex-col gap-3`}>
      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-borderSubtle text-textSecondary" aria-hidden="true">
          <Wallet className="w-4 h-4" />
        </span>
        <h2 className="text-[15px] font-semibold text-textPrimary">A practice account</h2>
      </div>
      <p className="text-[12px] leading-relaxed text-textSecondary">Options off the chain beside the chart — calls, puts and debit spreads — on today’s prices, with paper money. It carries from day to day.</p>
      <div className="grid grid-cols-4 gap-1.5 max-w-[440px]">
        {PRACTICE_SIZES.map(size => (
          <button key={size} type="button" disabled={!canStart} onClick={() => onPractice(size)} className="hit h-10 rounded-md border border-borderSubtle font-mono text-[12px] tnum text-textPrimary hover:border-silver/60 hover:bg-silver/[0.06] disabled:opacity-35 disabled:cursor-not-allowed transition-colors" data-paper-start-size={size}>
            {usd(size, 0)}
          </button>
        ))}
      </div>
      {/* in the landing's window nothing trades (data/paper/store.ts: never EMBEDDED) — say that, not "another tab" */}
      <p className="text-[10px] text-textMuted">{canStart ? 'Pick what it starts with.' : EMBEDDED ? 'Open the terminal to start one — nothing trades from this window.' : 'The accounts are open in another tab — take them here first.'}</p>
    </div>
    <div className={`${card} px-6 py-5 flex flex-col gap-3`}>
      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-borderSubtle text-textSecondary" aria-hidden="true">
          <ClipboardCheck className="w-4 h-4" />
        </span>
        <h2 className="text-[15px] font-semibold text-textPrimary">An evaluation</h2>
      </div>
      <p className="text-[12px] leading-relaxed text-textSecondary">A prop firm’s test, before you pay for one, on options: a floor that follows the best close, a limit on a day’s loss, a cap on the contracts open at once, two trading days, no day more than half the profit, flat by 15:59 New York.</p>
      {/* the plans as a small table — a head row says what each figure is (PlanRows) */}
      <PlanRows onStart={onEvaluation} disabled={!canStart} titleOf={p => `Start the ${p.label} at ${usd(p.size, 0)}`} rowKey="paper-start-plan" startKey="paper-start-eval" />
    </div>
  </div>
);

export default StartCard;
