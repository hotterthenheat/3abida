/*
  THE ONE HEADER ROW OF A TERRAIN PANE (the Terrain UI pass, 2026-10-14 — the owner's order: "header (one row: ticker,
  price, change, Live/data-age chip, timeframe, expiry window, jump Today/1W/1M/6M/1Y/Max + calendar, Replay, alerts,
  layers, ?)"). The pane hands in its own pieces — the identity it already sheds by its measured budget, the facts, the
  timeframe tabs it picked the form of, the toolbar's three doors — and this row lays them on ONE line that never wraps
  and never clips a figure: what the column cannot pay for is shed, the full control first to a small trigger, then
  away, in the order a reader loses least. The row stands at rest (no hover needed to read it); the rest of the
  toolbar rides the hover row under it, as before.
*/
import { useEffect, useState, type ReactNode } from 'react';
import { Calendar, ChevronDown, CircleHelp } from 'lucide-react';
import PopoverCard from '../ui/PopoverCard';
import { openKeySheet } from '../layout/paletteDoor';
import { TIMEFRAMES, type Timeframe } from '../../data/timeframe';
import type { PaneAge } from './paneAge';

/** The jumps: the session, a week, a month, six months, a year, everything the tape holds */
export type JumpSpan = 'today' | '1w' | '1m' | '6m' | '1y' | 'max';
export const JUMP_SPANS: { value: JumpSpan; label: string; hint: string }[] = [
  { value: 'today', label: 'Today', hint: "The session from its open — the pane's own intraday timeframe" },
  { value: '1w', label: '1W', hint: 'The last week — 15-minute bars at least' },
  { value: '1m', label: '1M', hint: 'The last month — hourly bars' },
  { value: '6m', label: '6M', hint: 'Six months of day bars' },
  { value: '1y', label: '1Y', hint: 'A year of day bars' },
  { value: 'max', label: 'Max', hint: 'Everything the tape holds, day bars' },
];

/** The expiry windows on the feed (Terrain's RailCut: the three windows and the 60-day book) */
export type WindowValue = 'w:0dte' | 'w:fri' | 'w:opex' | 'book';
export const WINDOW_OPTS: { value: WindowValue; short: string; label: string; hint: string }[] = [
  { value: 'w:0dte', short: '0DTE', label: '0DTE', hint: "The contracts that settle the session's own day" },
  { value: 'w:fri', short: 'Fri', label: 'To Friday', hint: 'Every expiry to the Friday of this week' },
  { value: 'w:opex', short: 'OPEX', label: 'To monthly OPEX', hint: "Every expiry to the month's third Friday (the next month's once it has passed)" },
  { value: 'book', short: '60d', label: 'All 60 days', hint: "The field: every expiry within 60 days; the ladder reads Unusual Whales' book on every expiry" },
];

interface PaneHeadProps {
  /** The badge, the replay badge, the symbol chip, the link chip, the compare + — shed by the host's own budget */
  identity: ReactNode;
  /** The price, the change and an index's print chip — shed by the host's own budget */
  facts: ReactNode;
  /** How old what the pane shows is; null draws no chip (an index with no bars). `ageForm` 'dot': the dot alone, its
      words as the title — the host's budget */
  age: PaneAge | null;
  ageForm: 'words' | 'dot';
  /** The timeframe tabs with their trends, where the host's budget affords them; null, and the row draws its own
      trigger — the pane's timeframe as one small door that opens the list */
  timeframes: ReactNode | null;
  tf: { value: Timeframe; onChange: (tf: Timeframe) => void; held?: Partial<Record<Timeframe, string>> };
  /** The expiry window on the feed, at the form the host's budget affords; null off the feed or without the room */
  /** `date`: a listed date the rail's Expiry card picked ("Oct 17") — then no window is the one in hand, and the control
      says the date (the audit's A-39: it showed "60d" pressed while the field read one date) */
  window: { value: WindowValue; onChange: (v: WindowValue) => void; form: 'full' | 'trigger'; date?: string | null } | null;
  /** The jumps at the form the host's budget affords, and the calendar's bounds (ISO dates); null without the room */
  jump: { onSpan: (s: JumpSpan) => void; onDate: (iso: string) => void; minDate?: string; maxDate?: string; form: 'full' | 'trigger' } | null;
  /** Replay · Alerts · Layers — the toolbar's three doors (ChartToolbar `parts`); null when the host's budget sent them
      to the hover row */
  tools: ReactNode | null;
  /** The ? door — the keys for this page; off without the room (the ? key stands) */
  keys: boolean;
  /** The pop-out and the fullscreen doors */
  doors: ReactNode;
  /** Bumped by the host when the T key asks for the calendar (the jump to a date) */
  openDateNonce?: number;
  className?: string;
}

const PaneHead = ({ identity, facts, age, ageForm, timeframes, tf, window, jump, tools, keys, doors, openDateNonce = 0, className = '' }: PaneHeadProps) => {
  const [dateOpen, setDateOpen] = useState(false);
  const [draftDate, setDraftDate] = useState('');
  /* the T key: the calendar opens, and the date field takes the keys */
  useEffect(() => {
    if (!openDateNonce || !jump) return;
    setDateOpen(true);
    const id = requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-jump-date-input]')?.focus());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDateNonce]);
  const [tfOpen, setTfOpen] = useState(false);
  /* the window's and the jumps' small menus close on a pick, as the timeframe's does */
  const [winOpen, setWinOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  /* THE TIMEFRAME TRIGGER — the pane's interval as the door (every charting app's grammar), the list behind it, a held
     interval drawn disabled with its reason (the feed carries no seconds) */
  const tfTrigger = (
    <PopoverCard
      width={150}
      align="start"
      testId="pane-timeframe"
      open={tfOpen}
      onOpenChange={setTfOpen}
      trigger={
        <button type="button" title="Timeframe — − and = step it" aria-label={`Timeframe — ${tf.value}`} className="hit shrink-0 pointer-events-auto inline-flex items-center gap-0.5 h-[18px] px-1.5 rounded-[3px] border border-ink/[0.10] font-mono text-[11px] font-semibold text-textPrimary" data-pane-tf={tf.value} data-tf-trigger>
          {tf.value}
          <ChevronDown className="w-3 h-3 text-textMuted" aria-hidden />
        </button>
      }
    >
      <div role="group" aria-label="Timeframe" className="p-1.5 flex flex-col gap-0.5">
        {TIMEFRAMES.map(o => {
          const held = tf.held?.[o.value];
          const on = o.value === tf.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              disabled={!!held}
              title={held}
              onClick={() => {
                tf.onChange(o.value);
                setTfOpen(false);
              }}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-left font-mono text-[11px] transition-colors ${on ? 'bg-ink/[0.06] text-textPrimary font-semibold' : held ? 'text-textMuted cursor-not-allowed' : 'text-textSecondary hover:bg-ink/[0.03] hover:text-textPrimary'}`}
              data-tf-pick={o.value}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </PopoverCard>
  );
  const windowForm: 'full' | 'trigger' | 'none' = window?.form ?? 'none';
  const jumpForm: 'full' | 'trigger' | 'none' = jump?.form ?? 'none';
  const dated = window?.date ?? null;
  const current = window ? (dated ? { value: window.value, short: dated, label: dated, hint: 'One listed date, picked in the Expiry card — a window here reads a window instead' } : WINDOW_OPTS.find(o => o.value === window.value) ?? WINDOW_OPTS[3]) : null;
  const inHand = (v: WindowValue) => !dated && v === window?.value;
  const chip = 'hit h-[18px] px-1.5 rounded-[2px] font-mono text-[11px] transition-colors';
  const on = 'bg-ink/[0.14] text-textPrimary font-semibold';
  const off = 'text-textMuted hover:text-textPrimary';
  const windowControl =
    windowForm === 'none' || !window || !current ? null : windowForm === 'full' ? (
      <span role="group" aria-label="Expiry window" className="shrink-0 pointer-events-auto inline-flex items-center gap-0.5 rounded-[3px] border border-ink/[0.10] p-px" data-pane-window={dated ? 'date' : window.value}>
        {dated && (
          <span className={`${chip} ${on} inline-flex items-center`} title={current.hint} data-window-date>
            {dated}
          </span>
        )}
        {WINDOW_OPTS.map(o => (
          <button key={o.value} type="button" aria-pressed={inHand(o.value)} title={`${o.label} — ${o.hint}`} onClick={() => window.onChange(o.value)} className={`${chip} ${inHand(o.value) ? on : off}`} data-window-pick={o.value}>
            {o.short}
          </button>
        ))}
      </span>
    ) : (
      <PopoverCard
        width={240}
        align="start"
        testId="pane-window"
        open={winOpen}
        onOpenChange={setWinOpen}
        trigger={
          <button type="button" title={`Expiry window — ${current.label}: ${current.hint}`} aria-label={`Expiry window — ${current.label}`} className={`hit shrink-0 pointer-events-auto inline-flex items-center gap-0.5 h-[18px] px-1.5 rounded-[3px] border border-ink/[0.10] font-mono text-[11px] text-textPrimary`} data-pane-window={dated ? 'date' : window.value} data-window-trigger>
            {current.short}
            <ChevronDown className="w-3 h-3 text-textMuted" aria-hidden />
          </button>
        }
      >
        <div role="group" aria-label="Expiry window" className="p-1.5 flex flex-col gap-0.5">
          {WINDOW_OPTS.map(o => (
            <button key={o.value} type="button" aria-pressed={inHand(o.value)} onClick={() => { window.onChange(o.value); setWinOpen(false); }} className={`flex items-start gap-2 px-2 py-1.5 rounded text-left transition-colors hover:bg-ink/[0.03] ${inHand(o.value) ? 'text-textPrimary' : 'text-textSecondary'}`} data-window-pick={o.value}>
              <span className="font-mono text-[11px] font-semibold w-10 shrink-0">{o.short}</span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold">{o.label}</span>
                <span className="block text-[11px] text-textMuted leading-snug">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverCard>
    );
  const calendarDoor = jump && (
    <PopoverCard
      width={220}
      align="start"
      testId="pane-jump-date"
      open={dateOpen}
      onOpenChange={setDateOpen}
      trigger={
        <button type="button" title="Jump to a date — T" aria-label="Jump to a date" className={`${chip} ${off} pointer-events-auto inline-flex items-center`} data-jump-date>
          <Calendar className="w-3 h-3" aria-hidden />
        </button>
      }
    >
      <form
        className="p-2 flex flex-col gap-1.5"
        onSubmit={e => {
          e.preventDefault();
          if (!draftDate) return;
          jump.onDate(draftDate);
          setDateOpen(false);
        }}
      >
        <label className="text-[11px] text-textMuted" htmlFor="pane-jump-date-input">
          Jump to a day
        </label>
        <input id="pane-jump-date-input" type="date" value={draftDate} min={jump.minDate} max={jump.maxDate} onChange={e => setDraftDate(e.target.value)} className="h-7 rounded border border-borderSubtle bg-panel px-2 font-mono text-[11px] tnum text-textPrimary" data-jump-date-input />
        <button type="submit" disabled={!draftDate} className="hit h-6 rounded-[3px] bg-ink/[0.14] font-mono text-[11px] font-semibold text-textPrimary disabled:opacity-40">
          Go
        </button>
      </form>
    </PopoverCard>
  );
  const jumpControl =
    jumpForm === 'none' || !jump ? null : jumpForm === 'full' ? (
      <span role="group" aria-label="Jump the view" className="shrink-0 pointer-events-auto inline-flex items-center gap-0.5 rounded-[3px] border border-ink/[0.10] p-px" data-pane-jump>
        {JUMP_SPANS.map(j => (
          <button key={j.value} type="button" title={j.hint} onClick={() => jump.onSpan(j.value)} className={`${chip} ${off}`} data-jump={j.value}>
            {j.label}
          </button>
        ))}
        {calendarDoor}
      </span>
    ) : (
      <span className="shrink-0 pointer-events-auto inline-flex items-center gap-0.5" data-pane-jump="trigger">
        <PopoverCard
          width={200}
          align="start"
          testId="pane-jump"
          open={jumpOpen}
          onOpenChange={setJumpOpen}
          trigger={
            <button type="button" title="Jump the view — today, a week, a month, six months, a year, everything" aria-label="Jump the view" className="hit inline-flex items-center gap-0.5 h-[18px] px-1.5 rounded-[3px] border border-ink/[0.10] font-mono text-[11px] text-textMuted hover:text-textPrimary" data-jump-trigger>
              Jump
              <ChevronDown className="w-3 h-3" aria-hidden />
            </button>
          }
        >
          <div role="group" aria-label="Jump the view" className="p-1.5 flex flex-col gap-0.5">
            {JUMP_SPANS.map(j => (
              <button key={j.value} type="button" onClick={() => { jump.onSpan(j.value); setJumpOpen(false); }} className="flex items-baseline gap-2 px-2 py-1.5 rounded text-left text-textSecondary hover:bg-ink/[0.03] hover:text-textPrimary" data-jump={j.value}>
                <span className="font-mono text-[11px] font-semibold w-10 shrink-0">{j.label}</span>
                <span className="text-[11px] text-textMuted leading-snug">{j.hint}</span>
              </button>
            ))}
          </div>
        </PopoverCard>
        {calendarDoor}
      </span>
    );
  return (
    <div className={`pointer-events-none select-none flex items-center gap-2 whitespace-nowrap min-w-0 ${className}`} data-pane-head data-window-form={windowForm} data-jump-form={jumpForm}>
      <span className="shrink-0 flex items-center gap-2 pointer-events-auto">{identity}</span>
      {/* pointer-events-auto: the price's "as old as the data" title and the age chip's words (its only words in the dot
          form) stood in a row that takes no pointer, so neither could be hovered (the audit's A-18, A-23) */}
      <span className="shrink-0 flex items-center gap-1.5 pointer-events-auto">{facts}</span>
      {age && (
        /* THE AGE CHIP: live wears the signature's silver dot; old, the warn ink and its age — the data-age state (pass 3)
           reads the same words; as a dot alone the words are its title */
        <span
          className={`pointer-events-auto shrink-0 inline-flex items-center gap-1 h-[18px] ${ageForm === 'dot' ? 'px-0.5' : 'px-1.5'} rounded-[3px] font-mono text-[11px] tnum ${age.kind === 'live' ? 'text-textSecondary' : age.kind === 'old' ? 'text-warn bg-warn/[0.10]' : 'text-textMuted'}`}
          title={`${ageForm === 'dot' ? `${age.words} — ` : ''}${age.kind === 'live' ? 'Live — the newest bar, quote or column is within a bar of now' : age.kind === 'old' ? `The newest data is ${age.words} — the feed has not answered since` : age.kind === 'closed' ? 'The market is closed — the newest moment the pane holds' : 'Nothing dated yet'}`}
          aria-label={age.words}
          data-pane-age={age.kind}
          data-pane-age-form={ageForm}
        >
          <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${age.kind === 'live' ? 'bg-silver' : age.kind === 'old' ? 'bg-warn' : 'bg-textMuted'}`} />
          {ageForm === 'words' && age.words}
        </span>
      )}
      <span className="shrink-0 flex items-center gap-2 pointer-events-auto">{timeframes ?? tfTrigger}</span>
      {windowControl}
      {jumpControl}
      <span className="flex-1 min-w-0" aria-hidden />
      {tools && (
        <>
          <span className="shrink-0 w-px h-4 bg-borderSubtle" aria-hidden />
          <span className="shrink-0 flex items-center gap-1 pointer-events-auto">{tools}</span>
        </>
      )}
      {keys && (
        <button type="button" onClick={() => openKeySheet()} title="The keys for this page — ?" aria-label="The keys for this page" className="hit shrink-0 pointer-events-auto inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors" data-pane-keys>
          <CircleHelp className="w-3.5 h-3.5" aria-hidden />
        </button>
      )}
      <span className="shrink-0 flex items-center gap-1 pointer-events-auto">{doors}</span>
    </div>
  );
};

export default PaneHead;
