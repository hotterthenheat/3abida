/*
==================================================
  SLAYER TERMINAL - PAPER · THE ACCOUNT
  (components/paper/AccountCard.tsx)

  The account in hand, at the head of the Live Chart's
  right column (Noah, 2026-09-22: the strip that stood
  over the chart "should be remigrated to cover 'the
  contract' section of the right side panel … this
  leaves more room for the chart to move closer to the
  top"). What the strip said, as a card:

    PRACTICE     WORTH first — cash and the options at
                 the mark — then today and all time in
                 their direction's ink, what is free,
                 what is open; and a bar of what is TIED
                 UP in options (Paper trades nothing else
                 since 2026-09-30, so nothing is margined)
    EVALUATION   the figure that INVERTS: ROOM TO THE
                 FLOOR first (in the warn ink when a
                 quarter of the allowance or less is
                 left), then what it is worth, the day
                 and the day's room, the contract count,
                 the days traded, the clock to 15:59 —
                 and one bar from the floor to the target

  THE ACCOUNT IN HAND is the card's head: the picker
  (the practice account, the evaluation running, the
  finished ones — read-only), its status, Flatten, and
  ONE door for what an account starts and ends with —
  New: a practice account of a size, or an evaluation
  on a plan, and the running evaluation ended. The
  Evaluation page that held those went, with the paper
  Journal, the same day ("we got too carried away").
==================================================
*/

import { useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Plus, ShieldAlert } from 'lucide-react';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import { card, head } from '../review/DeskShell';
import { TRADES_WORDS, dirInk, usd, usdSigned } from '../review/words';
import { PRACTICE_SIZES, type EvalPlan, type EvalRead, type PaperAccount, type PaperView } from '../../data/paper/engine';
import { nyAt } from '../../data/paper/clock';
import PlanRows from './PlanRows';

const STATUS: Record<PaperAccount['status'], { word: string; ink: string }> = {
  open: { word: 'Open', ink: 'text-silver border-silver/50 bg-silver/[0.10]' },
  passed: { word: 'Passed', ink: 'text-bull border-bull/40 bg-bull/[0.10]' },
  failed: { word: 'Failed', ink: 'text-bear border-bear/40 bg-bear/[0.10]' },
  ended: { word: 'Closed', ink: 'text-textSecondary border-borderSubtle bg-ink/[0.03]' },
};

/** "in 2h 13m" · "in 9m" — the time to a moment, in the words a trader says */
const untilWords = (ms: number): string => {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m < 60 ? `in ${m}m` : `in ${Math.floor(m / 60)}h ${m % 60}m`;
};

/** One figure of the card: its name, the figure, and — where it has one — a line under it */
const Cell = ({ label, children, sub, title, testId }: { label: string; children: ReactNode; sub?: ReactNode; title?: string; testId?: string }) => (
  <div className="min-w-0" title={title}>
    <div className="text-[10px] text-textMuted whitespace-nowrap">{label}</div>
    <div className="mt-0.5 font-mono text-[13px] leading-tight tnum text-textPrimary whitespace-nowrap" data-trace-fact={testId}>
      {children}
    </div>
    {sub && <div className="mt-0.5 font-mono text-[10px] tnum text-textMuted whitespace-nowrap">{sub}</div>}
  </div>
);

/** ONE BAR FROM THE FLOOR TO THE TARGET: the start marked, the account's worth a dot on it, the way it has gone washed in its direction */
const FloorBar = ({ ev, worth }: { ev: EvalRead; worth: number }) => {
  const lo = ev.floor;
  const hi = Math.max(ev.targetAt, worth);
  const span = Math.max(1, hi - lo);
  const at = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / span) * 100)).toFixed(2)}%`;
  const start = ev.plan.size;
  const from = Math.min(start, worth);
  const to = Math.max(start, worth);
  const dayFloorOn = ev.dayFloor > lo && ev.dayFloor < hi;
  return (
    <div className="w-full" data-paper-floor-bar>
      <div className="relative h-5" aria-hidden="true">
        <span className="absolute inset-x-0 top-[9px] h-[3px] rounded-full bg-ink/[0.08]" />
        {/* the way the account has gone from where it started, in its direction */}
        <span className={`absolute top-[9px] h-[3px] rounded-full ${worth >= start ? 'bg-bull/70' : 'bg-bear/70'}`} style={{ left: at(from), width: `calc(${at(to)} - ${at(from)})` }} />
        {/* the start, and the day's own floor */}
        <span className="absolute top-[5px] w-px h-[11px] bg-textMuted" style={{ left: at(start) }} />
        {dayFloorOn && <span className="absolute top-[5px] w-px h-[11px] bg-warn" style={{ left: at(ev.dayFloor) }} title="The day’s own floor" />}
        <span className="absolute top-[4px] w-[13px] h-[13px] -ml-[6.5px] rounded-full border-2 border-panel bg-textPrimary shadow-[0_0_0_1px_rgb(var(--silver)/0.5)]" style={{ left: at(worth) }} />
      </div>
      <div className="flex justify-between font-mono text-[10px] tnum text-textMuted">
        <span>
          floor <span className="text-textSecondary">{usd(ev.floor, 0)}</span>
          {ev.floorStopped && <span> · stays there</span>}
        </span>
        <span>
          start <span className="text-textSecondary">{usd(start, 0)}</span>
        </span>
        <span>
          target <span className="text-textSecondary">{usd(ev.targetNeeded + start, 0)}</span>
          {ev.targetNeeded > ev.plan.target + 0.5 && <span className="text-warn"> · raised</span>}
        </span>
      </div>
    </div>
  );
};

/** WHAT IS TIED UP of what the account is worth: the options held, at the mark */
const TiedBar = ({ v }: { v: PaperView }) => {
  const worth = Math.max(1, v.equity);
  const opt = Math.max(0, v.optValue);
  const w = (x: number) => `${Math.min(100, (x / worth) * 100).toFixed(2)}%`;
  return (
    <div className="w-full" data-paper-tied>
      <div className="relative h-[5px] rounded-full bg-ink/[0.08] overflow-hidden flex" aria-hidden="true">
        <span className="h-full bg-silver/70" style={{ width: w(opt) }} />
      </div>
      <div className="mt-1 font-mono text-[10px] tnum text-textMuted">
        tied up in options <span className="text-textSecondary">{usd(opt, 0)}</span> of {usd(v.equity, 0)}
      </div>
    </div>
  );
};

const door = 'hit inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary transition-colors';

interface Props {
  account: PaperAccount;
  accounts: PaperAccount[];
  view: PaperView;
  ev: EvalRead | null;
  now: number;
  onPick: (id: string) => void;
  /** What an account starts and ends with — null where this tab cannot (another holds the accounts) */
  onPractice: ((size: number) => void) | null;
  onEvaluation: ((plan: EvalPlan) => void) | null;
  onEndEvaluation: ((id: string) => void) | null;
  onFlatten: (() => void) | null;
  /** Every working order cancelled — on a name's options, whose chain has no Order card to carry it */
  onCancelAll?: (() => void) | null;
}

const AccountCard = ({ account: a, accounts, view: v, ev, now, onPick, onPractice, onEvaluation, onEndEvaluation, onFlatten, onCancelAll = null }: Props) => {
  const [newOpen, setNewOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const status = STATUS[a.status];
  const options: DropdownOption<string>[] = accounts.map(x => ({ value: x.id, label: x.name, hint: `${x.kind === 'practice' ? 'Practice' : 'An evaluation'} · ${STATUS[x.status].word.toLowerCase()}${x.status === 'open' ? '' : x.statusWhy ? ` — ${x.statusWhy}` : ''}` }));
  const open = v.opt.length;
  const working = a.opt.orders.filter(o => o.status === 'working').length;
  const tight = ev ? ev.room <= ev.plan.maxLoss * 0.25 : false;
  const flatIn = ev ? ev.flatBy - now : 0;
  const flatWords = !ev ? '' : ev.inFlatWindow ? 'flat into the close' : nyAt(ev.flatBy).date === nyAt(now).date ? untilWords(flatIn) : `${new Date(ev.flatBy).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' })} 15:59`;
  const running = accounts.find(x => x.kind === 'evaluation' && x.status === 'open') ?? null;

  return (
    <div className={`${card} min-w-0 shrink-0 flex flex-col`} data-paper-account={a.id} data-paper-kind={a.kind} data-paper-status={a.status}>
      {/* the head wraps where it is narrow (a phone): New and Flatten are never cut (the audit's PR-15: "+ NE") */}
      <div className={`${head} px-3 gap-2 flex-wrap h-auto min-h-9 py-1`}>
        {/* bare: the head also holds Flatten and New — the word Account stays in the tooltip and the open card's heading */}
        <DropdownSelect label="Account" value={a.id} options={options} onChange={onPick} title="The account on the chart" testId="paper-account-pick" size="sm" bare />
        <span className={`inline-flex items-center h-5 px-1.5 rounded border font-mono text-[10px] font-bold uppercase tracking-widest ${status.ink}`} data-paper-status-chip>
          {status.word}
        </span>
        {a.sandbox && (
          <span className="inline-flex items-center h-5 px-1.5 rounded border border-borderSubtle font-mono text-[10px] uppercase tracking-widest text-textSecondary" title="Fees off — practice with nothing in the way">
            Sandbox
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {onCancelAll && a.status === 'open' && working > 0 && (
            <button type="button" onClick={onCancelAll} title="Every working order cancelled — what is open stays open" className={`hit ${door} hover:text-textPrimary hover:border-borderMuted`} data-paper-cancel-all>
              Cancel all
            </button>
          )}
          {onFlatten && a.status === 'open' && open + working > 0 && (
            <button type="button" onClick={onFlatten} title="Close everything open at the market and cancel everything working — now" className={`hit ${door} hover:text-bear hover:border-bear/50`} data-paper-flatten>
              <ShieldAlert className="w-3 h-3" /> Flatten
            </button>
          )}
          {(onPractice || onEvaluation) && (
            <Popover.Root
              open={newOpen}
              onOpenChange={o => {
                setNewOpen(o);
                if (!o) setEnding(false);
              }}
            >
              <Popover.Trigger asChild>
                <button type="button" title="A new practice account, or an evaluation" className={`hit ${door} hover:text-textPrimary hover:border-borderMuted data-[state=open]:text-textPrimary data-[state=open]:border-silver/50`} data-paper-new>
                  <Plus className="w-3 h-3" /> New
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content align="end" sideOffset={6} collisionPadding={12} className="z-[95] w-[400px] max-w-[calc(100vw-24px)] rounded-md border border-borderMuted bg-panel p-3 shadow-[0_14px_40px_rgba(0,0,0,0.45)] outline-none animate-soft-in" data-paper-new-card>
                  {onPractice && (
                    <>
                      <p className="text-[12px] font-medium text-textPrimary">A practice account</p>
                      <p className="mt-1 text-[11px] leading-snug text-textMuted">From the size you pick — {TRADES_WORDS}. The practice account you have now is closed at the market first and stays in the list; an Undo brings it back for a few seconds.</p>
                      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                        {PRACTICE_SIZES.map(size => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => {
                              setNewOpen(false);
                              onPractice(size);
                            }}
                            className="hit h-8 rounded-md border border-borderSubtle font-mono text-[11px] tnum text-textPrimary hover:border-silver/60 hover:bg-silver/[0.06] transition-colors"
                            data-paper-size={size}
                          >
                            {usd(size / 1000, 0)}K
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {onEvaluation && (
                    <div className={onPractice ? 'mt-3 pt-3 border-t border-borderSubtle/70' : ''}>
                      <p className="text-[12px] font-medium text-textPrimary">An evaluation</p>
                      <p className="mt-1 text-[11px] leading-snug text-textMuted">A prop firm’s test, on options: a floor that follows the best close, a day’s limit, a cap on the contracts open at once, two trading days, no day more than half the profit, flat by 15:59 New York.</p>
                      {/* the plans as a small table — a head row says what each figure is (PlanRows) */}
                      <div className="mt-2.5">
                        <PlanRows
                          compact
                          onStart={p => {
                            setNewOpen(false);
                            onEvaluation(p);
                          }}
                          disabled={!!running}
                          titleOf={p => (running ? `One evaluation runs at a time — ${running.name} is running` : `Start the ${p.label} at ${usd(p.size, 0)}`)}
                          rowKey="paper-plan"
                          startKey="paper-plan-start"
                        />
                      </div>
                      {running && onEndEvaluation && (
                        <div className="mt-2 pt-2 border-t border-borderSubtle/70 flex items-center gap-2" data-paper-end-eval>
                          <p className="flex-1 min-w-0 text-[11px] leading-snug text-textMuted">
                            {ending ? 'Everything open on it is closed at the market, and it is written down as ended — not passed, not failed.' : `${running.name} is running — one at a time.`}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              if (!ending) return setEnding(true);
                              setEnding(false);
                              setNewOpen(false);
                              onEndEvaluation(running.id);
                            }}
                            className={`hit ${door} shrink-0 ${ending ? 'text-bear border-bear/50' : 'hover:text-bear hover:border-bear/50'}`}
                            data-paper-end-eval-button={ending ? 'sure' : 'ask'}
                          >
                            {ending ? 'End it — sure' : 'End it'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}
        </span>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3">
        <p className="text-[11px] leading-snug text-textMuted" data-paper-subline>
          {a.status !== 'open' && a.statusWhy ? (
            <span className={a.status === 'failed' ? 'text-bear' : a.status === 'passed' ? 'text-bull' : 'text-textSecondary'}>{a.statusWhy}</span>
          ) : ev ? (
            `Options · the floor follows ${ev.plan.trailing === 'eod' ? 'the best close' : 'the best moment, open trades in'} · flat by 15:59 New York`
          ) : (
            `Options · $${a.fee.toFixed(2)} a contract each way · the account carries from day to day, and through a reload`
          )}
        </p>
        <div className="grid grid-cols-3 gap-x-4 gap-y-3" data-paper-facts>
          {ev ? (
            <>
              <div className="min-w-0">
                <div className="text-[10px] text-textMuted whitespace-nowrap">Room to the floor</div>
                <div className={`mt-0.5 font-mono text-[18px] leading-none font-semibold tnum whitespace-nowrap ${a.status !== 'open' ? 'text-textMuted' : tight ? 'text-warn' : 'text-textPrimary'}`} data-paper-room>
                  {usd(Math.max(0, ev.room), 0)}
                </div>
              </div>
              <Cell label="Worth" testId="paper-worth">
                {usd(v.equity)}
              </Cell>
              <Cell label="Today" testId="paper-today" title={`The day’s own floor is ${usd(ev.dayFloor, 0)} — reach it and the day is over`} sub={<span className={ev.dayOver ? 'text-warn' : undefined}>{ev.dayOver ? 'the day is over' : `${usd(Math.max(0, ev.dayRoom), 0)} left today`}</span>}>
                <span className={dirInk(v.today)}>{usdSigned(v.today, 0)}</span>
              </Cell>
              <Cell label="Contracts" testId="paper-contracts" title="Option contracts open — a spread counts once">
                <span className={ev.contractsOpen >= ev.plan.contracts ? 'text-warn' : ''}>{ev.contractsOpen}</span> <span className="text-textMuted">of {ev.plan.contracts}</span>
              </Cell>
              <Cell label="Days traded" testId="paper-days" title={`The target counts once ${ev.plan.minDays} trading ${ev.plan.minDays === 1 ? 'day has' : 'days have'} a closed trade`}>
                {ev.daysTraded} <span className="text-textMuted">of {ev.plan.minDays}</span>
              </Cell>
              {a.status === 'open' && (
                <Cell label="Flat by 15:59" testId="paper-flat-by">
                  <span className={ev.inFlatWindow || flatIn < 15 * 60_000 ? 'text-warn' : ''}>{flatWords}</span>
                </Cell>
              )}
            </>
          ) : (
            <>
              <div className="min-w-0">
                <div className="text-[10px] text-textMuted whitespace-nowrap">Worth</div>
                <div className="mt-0.5 font-mono text-[18px] leading-none font-semibold tnum text-textPrimary whitespace-nowrap" data-paper-worth>
                  {usd(v.equity)}
                </div>
              </div>
              <Cell label="Today" testId="paper-today">
                <span className={dirInk(v.today)}>{usdSigned(v.today)}</span>
              </Cell>
              <Cell label="All time" testId="paper-all-time">
                <span className={dirInk(v.allTime)}>{usdSigned(v.allTime)}</span>
              </Cell>
              <Cell label="Free" testId="paper-free" title="The cash — what pays for an option; nothing is margined">
                {usd(v.free)}
              </Cell>
              <Cell label="Open, up or down" testId="paper-open">
                <span className={dirInk(v.openPnl)}>{usdSigned(v.openPnl)}</span>
              </Cell>
            </>
          )}
        </div>
        {ev ? <FloorBar ev={ev} worth={v.equity} /> : <TiedBar v={v} />}
        <span className="font-mono text-[10px] tnum text-textMuted" data-paper-counts>
          {open} open · {working} working · {v.optTrades.length} closed · <span className={dirInk(v.closed)}>{usdSigned(v.closed, 0)}</span> closed
        </span>
      </div>
    </div>
  );
};

export default AccountCard;
