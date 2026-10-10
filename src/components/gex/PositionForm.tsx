/*
==================================================
  SLAYER TERMINAL - THE POSITION FORM
  (components/gex/PositionForm.tsx)

  Add or change one position, in a card that opens
  from the button that asked for it (Radix Popover,
  the house PopoverCard). One compact row of
  labelled fields — strike · call or put · own or
  sold · contracts · expires · what you paid — the
  way TradingView's strategy builder writes a leg.
  Two pills for the two-choice fields, a solid pill
  to save.
==================================================
*/

import { useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CARD } from '../ui/DropdownSelect';
import ExpiryPicker from '../ui/ExpiryPicker';
import { addPosition, updatePosition, todayExpiry, type Position, type Right, type Side } from '../../data/positions';

/* THE PICKED PILL AND THE DOOR ARE THE PLAIN INK PILL (the audit's X12: a literal #0a0a0a word on the silver) — the
   --text-primary fill takes the panel's ink for its word, on either ground */
const PICKED = { background: 'rgb(var(--text-primary))', color: 'rgb(var(--panel))' };

interface Draft {
  strike: string;
  right: Right;
  side: Side;
  contracts: string;
  expiry: string;
  entry: string;
}

const draftOf = (p: Partial<Position> | undefined, defaults: { strike: number; expiry?: string; right?: Right }): Draft => ({
  strike: String(p?.strike ?? defaults.strike),
  right: p?.right ?? defaults.right ?? 'C',
  side: p?.side ?? 'long',
  contracts: String(p?.contracts ?? 1),
  expiry: p?.expiry ?? defaults.expiry ?? todayExpiry(),
  entry: p?.entry != null ? String(p.entry) : '',
});

const Field = ({ label, children, width }: { label: string; children: ReactNode; width?: number }) => (
  <label className="flex flex-col gap-1 min-w-0" style={{ width }}>
    <span className="text-[10px] text-textMuted">{label}</span>
    {children}
  </label>
);

const inputCls = 'h-8 px-2 rounded-md border border-borderSubtle bg-panel font-mono text-[12px] tnum text-textPrimary outline-none focus:border-silver/60 transition-colors';

/* A pill that IS a side of the market wears it under the pointer — Call green, Put red — the rule every Calls/Puts card
   follows (DropdownSelect's `tone`; Noah, 2026-09-19). The picked pill stays silver: silver is where you are. */
const PILL_HOVER = { plain: 'hover:text-textPrimary hover:bg-ink/[0.05]', bull: 'hover:text-bull hover:bg-bull/[0.12]', bear: 'hover:text-bear hover:bg-bear/[0.12]' } as const;
const Pills = <T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; tone?: 'bull' | 'bear' }[]; onChange: (v: T) => void; label: string }) => (
  <span role="group" aria-label={label} className="inline-flex h-8 rounded-md border border-borderSubtle p-[2px] gap-[2px]">
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        aria-pressed={o.value === value}
        onClick={() => onChange(o.value)}
        data-tone={o.tone}
        className={`px-2.5 rounded-[4px] text-[11px] font-medium transition-colors ${o.value === value ? '' : `text-textSecondary ${PILL_HOVER[o.tone ?? 'plain']}`}`}
        style={o.value === value ? PICKED : undefined}
      >
        {o.label}
      </button>
    ))}
  </span>
);

interface PositionFormProps {
  ticker: string;
  /** Absent = a new position */
  position?: Position;
  /** The strike a new position starts on */
  defaultStrike: number;
  /** The expiry and side a new position starts on — the chain's own (the audit's WE-3: the form opened on today while
      the chain stood on another date) */
  defaultExpiry?: string;
  defaultRight?: Right;
  trigger: ReactNode;
  align?: 'start' | 'end' | 'center';
}

const PositionForm = ({ ticker, position, defaultStrike, defaultExpiry, defaultRight, trigger, align = 'end' }: PositionFormProps) => {
  const [open, setOpen] = useState(false);
  const defaults = { strike: defaultStrike, expiry: defaultExpiry, right: defaultRight };
  const [draft, setDraft] = useState<Draft>(() => draftOf(position, defaults));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }));

  const strike = Number(draft.strike);
  const contracts = Math.round(Number(draft.contracts));
  const entry = draft.entry.trim() === '' ? undefined : Number(draft.entry);
  const valid = Number.isFinite(strike) && strike > 0 && Number.isFinite(contracts) && contracts >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(draft.expiry) && (entry === undefined || (Number.isFinite(entry) && entry >= 0));
  /* WHY ADD STAYS OFF, said beside it (the audit's WE-3: "abc" as a strike disabled Add with no word) */
  const problem = !(Number.isFinite(strike) && strike > 0)
    ? 'The strike is a price, like 475 or 172.50'
    : !(Number.isFinite(contracts) && contracts >= 1)
      ? 'Contracts is a whole number, 1 or more'
      : entry !== undefined && !(Number.isFinite(entry) && entry >= 0)
        ? 'What you paid is a price per share, like 2.10 — or leave it blank'
        : !/^\d{4}-\d{2}-\d{2}$/.test(draft.expiry)
          ? 'Pick the day it expires'
          : null;

  const save = () => {
    if (!valid) return;
    const fields = { strike, right: draft.right, side: draft.side, contracts, expiry: draft.expiry, entry };
    if (position) updatePosition(position.id, fields);
    else addPosition({ ticker, ...fields });
    setOpen(false);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={o => {
        if (o) setDraft(draftOf(position, defaults));
        setOpen(o);
      }}
    >
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={align} sideOffset={6} collisionPadding={12} className={`${CARD} p-0 outline-none`} style={{ width: 560 }} data-position-form>
          <div className="px-4 pt-3 pb-2 border-b border-borderSubtle/70 flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-textPrimary">{position ? 'Change this position' : `New position on ${ticker}`}</span>
            <span className="ml-auto text-[10px] text-textMuted">premium in points per share, as your broker shows it</span>
          </div>
          <form
            className="px-4 py-3 flex flex-wrap items-end gap-3"
            onSubmit={e => {
              e.preventDefault();
              save();
            }}
          >
            <Field label="Strike" width={88}>
              <input className={inputCls} inputMode="decimal" value={draft.strike} onChange={e => set('strike', e.target.value)} data-field="strike" autoFocus />
            </Field>
            <Field label="Call or put">
              <Pills label="Call or put" value={draft.right} options={[{ value: 'C', label: 'Call', tone: 'bull' }, { value: 'P', label: 'Put', tone: 'bear' }]} onChange={v => set('right', v)} />
            </Field>
            <Field label="Own or sold">
              <Pills label="Own or sold" value={draft.side} options={[{ value: 'long', label: 'You own' }, { value: 'short', label: 'You sold' }]} onChange={v => set('side', v)} />
            </Field>
            <Field label="Contracts" width={72}>
              <input className={inputCls} inputMode="numeric" value={draft.contracts} onChange={e => set('contracts', e.target.value)} data-field="contracts" />
            </Field>
            <Field label="Expires" width={150}>
              <ExpiryPicker value={draft.expiry} onChange={v => set('expiry', v)} testId="expiry" width={150} />
            </Field>
            <Field label="What you paid (optional)" width={140}>
              {/* blank: the position is marked at this tick's price and the return reads from there (2026-09-16) */}
              <input className={inputCls} inputMode="decimal" placeholder="e.g. 2.10" title="Leave it blank and the position is marked at this tick's price — its return reads from there" value={draft.entry} onChange={e => set('entry', e.target.value)} data-field="entry" />
            </Field>
            <div className="basis-full flex items-center justify-end gap-2 pt-1">
              {problem && (
                <span className="mr-auto text-[11px] text-warn" role="status" data-form-problem>
                  {problem}
                </span>
              )}
              <Popover.Close asChild>
                <button type="button" className="h-8 px-3 rounded-full border border-borderSubtle text-[12px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
                  Cancel
                </button>
              </Popover.Close>
              <button type="submit" disabled={!valid} data-save-position className="h-8 px-4 rounded-full text-[12px] font-semibold disabled:opacity-40 transition-opacity" style={PICKED}>
                {position ? 'Save' : 'Add'}
              </button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default PositionForm;
