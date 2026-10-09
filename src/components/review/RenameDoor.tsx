/*
==================================================
  SLAYER TERMINAL - REVIEW · A SESSION'S NAME
  (components/review/RenameDoor.tsx)

  A pencil that opens a small card with the name in a
  field: Enter or "Save" keeps it, Esc or a click
  elsewhere leaves it as it was. A CARD, not a field
  in the row: the sessions list is a grid, and a grid
  takes the arrow keys, Enter and Space for itself —
  a field inside one of its cells loses the caret to
  it. The card is drawn outside the grid, so the keys
  are the field's.
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Pencil } from 'lucide-react';

const SILVER_FILL = 'rgb(var(--silver-fill))';

interface Props {
  name: string;
  onSave: (name: string) => void;
  /** The pencil's box — the row's other doors are 24px */
  className?: string;
}

const RenameDoor = ({ name, onSave, className = 'w-6 h-6' }: Props) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const field = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (open) setDraft(name);
  }, [open, name]);
  const save = () => {
    const next = draft.trim();
    if (next && next !== name) onSave(next);
    setOpen(false);
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" onClick={e => e.stopPropagation()} title="Rename this session" aria-label={`Rename ${name}`} className={`inline-flex items-center justify-center rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] data-[state=open]:text-silver transition-colors ${className}`} data-session-rename>
          <Pencil className="w-3 h-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          onClick={e => e.stopPropagation()}
          onOpenAutoFocus={e => {
            e.preventDefault();
            field.current?.focus();
            field.current?.select();
          }}
          className="z-[95] w-[300px] rounded-md border border-borderMuted bg-panel p-2.5 shadow-[0_14px_40px_rgba(0,0,0,0.45)] outline-none animate-soft-in"
          data-session-rename-card
        >
          <form
            className="flex items-center gap-2"
            onSubmit={e => {
              e.preventDefault();
              save();
            }}
          >
            <input ref={field} value={draft} onChange={e => setDraft(e.target.value)} maxLength={60} aria-label="The session's name" className="h-8 min-w-0 flex-1 px-2 rounded-md border border-borderSubtle bg-panel text-[12px] text-textPrimary outline-none focus:border-silver/60 transition-colors" data-session-rename-field />
            <button type="submit" disabled={!draft.trim()} className="shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold disabled:opacity-35 transition-opacity hover:opacity-90" style={{ background: SILVER_FILL, color: 'rgb(var(--night))' }}>
              Save
            </button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default RenameDoor;
