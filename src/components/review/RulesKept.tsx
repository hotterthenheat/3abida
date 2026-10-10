/*
==================================================
  SLAYER TERMINAL - THE RULES KEPT, WEEK BY WEEK
  (components/review/RulesKept.tsx)

  The ideas of 2026-10-09: a trend of the rules kept —
  never called a score, never a streak. A column a week:
  of the trades the reader answered "followed the plan?"
  on, how many were followed with no mistake tagged on
  them. The column's height is that share; its words
  are the count ("4 of 6"). A week with no answers says
  so instead of drawing nothing.
==================================================
*/

import { card, headWord } from './DeskShell';
import type { KeptWeek } from '../../data/review/journalFigures';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (day: string) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;

const RulesKept = ({ weeks }: { weeks: KeptWeek[] }) => {
  const any = weeks.some(w => w.said > 0);
  return (
    <div className={`${card} flex flex-col min-w-0`} data-journal-rules-kept>
      <div className="px-5 pt-4 pb-2 flex items-baseline gap-3 flex-wrap">
        <span className={headWord}>Your rules, kept</span>
        <span className="font-mono text-[11px] text-textMuted">a column a week · of the trades you answered on the plan, how many followed it with no mistake tagged</span>
      </div>
      {!any ? (
        <div className="px-5 py-8 text-center font-mono text-[11px] text-textMuted">Answer “Followed the plan” on a trade’s page and the weeks fill in here</div>
      ) : (
        <div className="px-5 pb-4 pt-2 flex items-end gap-2 overflow-x-auto" role="list" aria-label="Rules kept, week by week">
          {weeks.map(w => {
            const share = w.said ? w.kept / w.said : 0;
            return (
              <div key={w.from} role="listitem" className="flex flex-col items-center gap-1 min-w-[52px] max-w-[96px] flex-1" title={`Week of ${short(w.from)}: ${w.said ? `${w.kept} of ${w.said} answered trades followed the plan with no mistake` : 'no trade answered on the plan'} · ${w.n} closed`} data-journal-kept-week={w.from}>
                <span className="font-mono text-[11px] tnum text-textPrimary">{w.said ? `${w.kept} of ${w.said}` : '—'}</span>
                <span className="relative w-full h-[72px] rounded-[3px] bg-ink/[0.05] overflow-hidden" aria-hidden="true">
                  {w.said > 0 && <span className="absolute inset-x-0 bottom-0 bg-silver/70" style={{ height: `${Math.max(4, share * 100)}%` }} />}
                </span>
                <span className="font-mono text-[10px] tnum text-textMuted whitespace-nowrap">{short(w.from)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RulesKept;
