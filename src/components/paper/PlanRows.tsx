/*
  PAPER · THE EVALUATION PLANS, AS ROWS — the one small table the start page (StartCard) and the account card's New
  door (AccountCard) share: a head row that says what each figure is, then a plan a row. It replaces a run-on sentence
  ("target +$3,000 · may lose $2,000 · a day $1,000 · 5 at once" — Noah, 2026-09-26: "this doesnt make sense") with the
  prop firm's own words, TARGET · LOSS LIMIT · DAILY LIMIT · CONTRACTS, each carrying its plain sentence on hover.
  THE TABLE KNOWS ITS ROOM (the chain head's rule): under ~420px of box — a phone, or the start page's two cards side by
  side at a 1024px window — the four columns cannot hold their words, so each plan is its own block: the plan and Start
  on a line, the four figures under their own labels beneath. Measured on the box itself, never the window.
*/

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EVAL_PLANS, type EvalPlan } from '../../data/paper/engine';
import { usd } from '../review/words';

const SILVER_FILL = 'rgb(var(--silver-fill))';

const HEADS: readonly { word: string; title: string }[] = [
  { word: 'Target', title: 'The profit that passes it' },
  { word: 'Loss limit', title: 'The most it may lose in all — a floor that follows the best close' },
  { word: 'Daily limit', title: 'The most it may lose in one day' },
  { word: 'Contracts', title: 'The most contracts open at once — ten micros are one' },
];

/** A plan's four figures, in the heads' order */
const figuresOf = (p: EvalPlan): { node: ReactNode; ink: string }[] => [
  { node: `+${usd(p.target, 0)}`, ink: 'text-bull' },
  { node: usd(p.maxLoss, 0), ink: 'text-textSecondary' },
  { node: usd(p.dayLoss, 0), ink: 'text-textSecondary' },
  { node: `up to ${p.contracts}`, ink: 'text-textSecondary' },
];

const headClass = 'text-[9px] uppercase tracking-wider text-textMuted whitespace-nowrap';

interface Props {
  onStart: (plan: EvalPlan) => void;
  /** No plan can start — the reason is the button's title */
  disabled?: boolean;
  titleOf: (plan: EvalPlan) => string;
  /** The popover's size (the account card's door), else the start page's */
  compact?: boolean;
  /** The data attributes the probes look for: the row's and the button's */
  rowKey: string;
  startKey: string;
}

/** The least a box needs for the four columns and their heads: the label, four × 62, Start, the gaps */
const ROOM_FOR_TABLE = { card: 420, pop: 372 };

const PlanRows = ({ onStart, disabled = false, titleOf, compact = false, rowKey, startKey }: Props) => {
  const cell = `${compact ? 'py-1.5' : 'py-2'} border-t border-borderSubtle/60 min-w-0 truncate`;
  /* the box measured: the table where it fits, a block a plan where it does not */
  const box = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const need = compact ? ROOM_FOR_TABLE.pop : ROOM_FOR_TABLE.card;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < need));
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact]);
  const start = (p: EvalPlan, attr: boolean) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onStart(p)}
      title={titleOf(p)}
      className={`${compact ? 'h-6 px-2.5 text-[10px]' : 'h-7 px-3 text-[11px]'} rounded-full font-semibold disabled:opacity-35 disabled:cursor-not-allowed transition-opacity hover:opacity-90`}
      style={{ background: SILVER_FILL, color: '#0a0a0a' }}
      {...(attr ? { [`data-${startKey}`]: p.label } : {})}
    >
      Start
    </button>
  );
  return (
    <div ref={box} className="min-w-0" data-paper-plans-box={narrow ? 'narrow' : 'table'}>
      {/* the table, where four columns have room */}
      <div className={`${narrow ? 'hidden' : 'grid'} items-center font-mono tnum ${compact ? 'grid-cols-[32px_repeat(4,minmax(0,1fr))_auto] gap-x-2 text-[10px]' : 'grid-cols-[40px_repeat(4,minmax(0,1fr))_auto] gap-x-3 text-[11px]'}`} data-paper-plans>
        {/* the head row: what each figure is */}
        <span aria-hidden="true" />
        {HEADS.map(h => (
          <span key={h.word} title={h.title} className={`pb-1 min-w-0 ${headClass}`}>
            {h.word}
          </span>
        ))}
        <span aria-hidden="true" />
        {EVAL_PLANS.map(p => (
          <div key={p.label} className="contents" {...{ [`data-${rowKey}`]: p.label }}>
            <span className={`${cell} ${compact ? 'text-[11px]' : 'text-[12px]'} font-semibold text-textPrimary`}>{p.label}</span>
            {figuresOf(p).map((f, i) => (
              <span key={HEADS[i].word} className={`${cell} ${f.ink}`}>
                {f.node}
              </span>
            ))}
            <span className={`${cell} flex justify-end`}>{start(p, true)}</span>
          </div>
        ))}
      </div>
      {/* a narrow box: a block a plan */}
      <div className={`${narrow ? 'flex' : 'hidden'} flex-col font-mono tnum text-[11px]`} data-paper-plans-narrow>
        {EVAL_PLANS.map(p => (
          <div key={p.label} className="py-2.5 border-t border-borderSubtle/60 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-semibold text-textPrimary">{p.label}</span>
              <span className="ml-auto">{start(p, false)}</span>
            </div>
            <div className="grid grid-cols-4 gap-x-2">
              {figuresOf(p).map((f, i) => (
                <span key={HEADS[i].word} className="flex flex-col gap-0.5 min-w-0" title={HEADS[i].title}>
                  <span className={headClass}>{HEADS[i].word}</span>
                  <span className={`${f.ink} truncate`}>{f.node}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanRows;
