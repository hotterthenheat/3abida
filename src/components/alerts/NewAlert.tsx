/*
==================================================
  SLAYER TERMINAL - SETTING ONE
  (components/alerts/NewAlert.tsx)

  The form that arms an alert, in one place.
==================================================

  THE DESK COULD MANAGE ALERTS AND NOT MAKE ONE. `/alerts` listed everything
  set, everything fired and the record of both, and had no way to arm a
  single one — a reader who wanted a new alert had to find the name, open
  its pane, and use a menu on a different page. A management surface with no
  create is a report, not a desk.

  ONE FORM, TWO PLACES. The rail carried its own copy; lifting it means the
  page and the rail refuse for the same reasons, in the same words, and a
  third surface that wants to arm something does not write a fourth.

  AND IT SAYS WHICH THING WENT WRONG. `armPrice` returning null told every
  caller the same story — "already set, or this name is at its eight" —
  which was a lie three times out of four: the real reason was usually that
  the number typed was not a price this name will ever see. The store now
  answers that question separately (`priceAlertProblem`), and the reason
  under the field is the reason.
*/

import { useState } from 'react';
import { Plus } from 'lucide-react';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import { armGexFlip, armNewSupreme, armPrice, priceAlertProblem, type Alert } from '../gex/alertStore';
import { spotOf } from '../../core/paper/market';

export type NewAlertKind = 'price' | 'gexflip' | 'supreme';

const KINDS: DropdownOption<NewAlertKind>[] = [
  { value: 'price', label: 'Price', hint: 'When the name trades through a level you name' },
  { value: 'gexflip', label: 'Gamma flip', hint: 'When dealer gamma changes sign' },
  { value: 'supreme', label: 'New supreme', hint: 'When a new heaviest strike takes over' },
];

export interface NewAlertProps {
  /** Called with the refusal, or '' when the last one clears */
  onRefused: (s: string) => void;
  /** Called with the alert that was armed, for a surface that wants to react */
  onArmed?: (a: Alert, ticker: string) => void;
  /** 'rail' stacks; 'row' lays the whole form out on one line for a page */
  layout?: 'rail' | 'row';
  /** Pre-fill the name — a page that already knows which one */
  ticker?: string;
}

const NewAlert = ({ onRefused, onArmed, layout = 'rail', ticker: seed }: NewAlertProps) => {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState(seed ?? '');
  const [kind, setKind] = useState<NewAlertKind>('price');
  const [price, setPrice] = useState('');

  const sym = ticker.trim().toUpperCase();
  const spot = sym ? spotOf(sym) : null;
  const ready = sym.length > 0 && (kind !== 'price' || price.trim().length > 0);

  const set = (): void => {
    if (!ready) return;
    let made: Alert | null = null;
    if (kind === 'price') {
      /* The side an alert has to be crossed from is fixed at arming, off the
         spot — so a name the feed has not seeded cannot arm a price alert
         without the terminal inventing which way it meant. It says so, and
         so does every other way this can fail. */
      const why = priceAlertProblem(sym, Number(price.trim()), spot ?? NaN);
      if (why) {
        onRefused(why);
        return;
      }
      made = armPrice(sym, Number(price.trim()), spot!);
    } else if (kind === 'gexflip') made = armGexFlip(sym);
    else made = armNewSupreme(sym);

    if (!made) {
      onRefused(`${sym} already has that one, or is already carrying its most.`);
      return;
    }
    onRefused('');
    onArmed?.(made, sym);
    setPrice('');
    if (layout === 'rail') setOpen(false);
  };

  const row = layout === 'row';

  if (!open) {
    return (
      <div className={row ? '' : 'shrink-0 px-3.5 py-2 border-t border-borderSubtle/70'}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${
            row ? 'h-7 px-3' : 'w-full h-7'
          } inline-flex items-center justify-center gap-1.5 rounded-md border border-borderSubtle text-[11px] font-semibold text-textPrimary hover:border-borderMuted transition-colors`}
          data-alerts-new
        >
          <Plus className="w-3 h-3" aria-hidden="true" />
          {row ? 'Set an alert' : 'Set one from here'}
        </button>
      </div>
    );
  }

  const nameField = (
    <input
      value={ticker}
      onChange={e => setTicker(e.target.value.slice(0, 8))}
      placeholder="Ticker"
      aria-label="Ticker"
      autoFocus
      className="w-[86px] h-7 px-2 rounded border border-borderSubtle bg-inputBg font-mono text-[11px] font-semibold uppercase text-textPrimary placeholder:text-textMuted placeholder:font-normal placeholder:normal-case outline-none focus:border-silver/60"
    />
  );
  const priceField = kind === 'price' && (
    <span className={`flex items-center gap-1.5 ${row ? '' : 'w-full'}`}>
      <input
        value={price}
        onChange={e => setPrice(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') set();
        }}
        inputMode="decimal"
        placeholder="Price"
        aria-label="Price"
        className={`${row ? 'w-[110px]' : 'flex-1'} h-7 px-2 rounded border border-borderSubtle bg-inputBg font-mono text-[11px] tnum text-textPrimary placeholder:text-textMuted outline-none focus:border-silver/60`}
      />
      {spot != null && <span className="font-mono text-[9px] text-textMuted whitespace-nowrap">now {spot.toFixed(2)}</span>}
    </span>
  );
  const buttons = (
    <span className={`flex items-center gap-1.5 ${row ? '' : 'w-full'}`}>
      <button
        type="button"
        onClick={set}
        disabled={!ready}
        className={`${
          row ? 'h-7 px-3' : 'flex-1 h-7'
        } rounded-md border border-borderMuted text-[11px] font-semibold text-textPrimary hover:bg-ink/[0.05] disabled:opacity-40 transition-colors`}
        data-alerts-new-set
      >
        Set it
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          onRefused('');
        }}
        className="h-7 px-2.5 rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-textPrimary transition-colors"
      >
        Cancel
      </button>
    </span>
  );

  if (row) {
    return (
      <div className="flex flex-wrap items-center gap-1.5" data-alerts-new-form>
        {nameField}
        <DropdownSelect<NewAlertKind> label="Kind" value={kind} options={KINDS} onChange={setKind} title="What to watch" testId="alerts-new-kind" align="start" />
        {priceField}
        {buttons}
      </div>
    );
  }

  return (
    <div className="shrink-0 px-3.5 py-2.5 border-t border-borderSubtle/70 flex flex-col gap-2" data-alerts-new-form>
      <div className="flex items-center gap-1.5">
        {nameField}
        <DropdownSelect<NewAlertKind> label="Kind" value={kind} options={KINDS} onChange={setKind} title="What to watch" testId="alerts-new-kind" align="start" />
      </div>
      {priceField}
      {buttons}
    </div>
  );
};

export default NewAlert;
