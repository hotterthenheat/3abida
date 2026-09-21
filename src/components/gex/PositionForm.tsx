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
import { Name } from '../ui/Name';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const SILVER_FILL = 'rgb(var(--silver-fill))'; /* the silver as a SURFACE — a filled pill with the dark word on it, the holo flat form on either ground */

interface Draft {
  strike: string;
  right: Right;
  side: Side;
  contracts: string;
  expiry: string;
  entry: string;
}

const draftOf = (p: Partial<Position> | undefined, defaults: { strike: number }): Draft => ({
  strike: String(p?.strike ?? defaults.strike),
  right: p?.right ?? 'C',
  side: p?.side ?? 'long',
  contracts: String(p?.contracts ?? 1),
  expiry: p?.expiry ?? todayExpiry(),
  entry: p?.entry != null ? String(p.entry) : '',
});

const Field = ({ label, children, width }: { label: string; children: ReactNode; width?: number }) => (
  <label className="flex flex-col gap-1 min-w-0" style={{ width }}>
    <span className="text-[10px] text-textMuted">{label}</span>
    {children}
  </label>
);

const inputCls = 'h-8 px-2 rounded-md border border-borderSubtle bg-panel font-mono text-[12px] tnum text-textPrimary outline-none focus:border-silver/60 transition-colors';

const Pills = <T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) => (
  <span role="group" aria-label={label} className="inline-flex h-8 rounded-md border border-borderSubtle p-[2px] gap-[2px]">
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        aria-pressed={o.value === value}
        onClick={() => onChange(o.value)}
        className="px-2.5 rounded-[4px] text-[11px] font-medium transition-colors"
        style={o.value === value ? { background: SILVER_FILL, color: '#0a0a0a' } : { color: 'rgb(var(--text-secondary))' }}
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
  trigger: ReactNode;
  align?: 'start' | 'end' | 'center';
}

const PositionForm = ({ ticker, position, defaultStrike, trigger, align = 'end' }: PositionFormProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(position, { strike: defaultStrike }));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }));

  const strike = Number(draft.strike);
  const contracts = Math.round(Number(draft.contracts));
  const entry = draft.entry.trim() === '' ? undefined : Number(draft.entry);
  const valid = Number.isFinite(strike) && strike > 0 && Number.isFinite(contracts) && contracts >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(draft.expiry) && (entry === undefined || (Number.isFinite(entry) && entry >= 0));

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
        if (o) setDraft(draftOf(position, { strike: defaultStrike }));
        setOpen(o);
      }}
    >
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={align} sideOffset={6} collisionPadding={12} className={`${CARD} p-0 outline-none`} style={{ width: 560 }} data-position-form>
          <div className="px-4 pt-3 pb-2 border-b border-borderSubtle/70 flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-textPrimary">{position ? 'Change this position' : <>New position on <Name t={ticker} size={13} /></>}</span>
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
              <Pills label="Call or put" value={draft.right} options={[{ value: 'C', label: 'Call' }, { value: 'P', label: 'Put' }]} onChange={v => set('right', v)} />
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
              <input className={inputCls} inputMode="decimal" placeholder="e.g. 2.10" value={draft.entry} onChange={e => set('entry', e.target.value)} data-field="entry" />
            </Field>
            <div className="basis-full flex items-center justify-end gap-2 pt-1">
              <Popover.Close asChild>
                <button type="button" className="h-8 px-3 rounded-full border border-borderSubtle text-[12px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
                  Cancel
                </button>
              </Popover.Close>
              <button type="submit" disabled={!valid} data-save-position className="h-8 px-4 rounded-full text-[12px] font-semibold transition-opacity" style={{ background: SILVER_FILL, color: '#0a0a0a' }}>
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
