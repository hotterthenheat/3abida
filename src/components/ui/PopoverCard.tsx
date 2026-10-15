/*
==================================================
  SLAYER TERMINAL - POPOVER CARD
  (components/ui/PopoverCard.tsx)

  A card that opens from a control and holds a
  small tool — a list of switches, a key, a form —
  rather than a row of chips on the toolbar. Radix
  Popover underneath (focus trap, outside-click,
  Escape, portal, collision placement); the same
  card surface every dropdown on the terminal
  wears.
==================================================
*/

import * as Popover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { CARD } from './DropdownSelect';

interface PopoverCardProps {
  /** The control that opens the card — rendered as-is (asChild) */
  trigger: ReactNode;
  title?: string;
  /** Small words beside the title */
  meta?: ReactNode;
  children: ReactNode;
  width?: number;
  align?: 'start' | 'end' | 'center';
  onOpenChange?: (open: boolean) => void;
  /** Controlled: the host holds whether the card is open (a box that opens a card at one of its sections) */
  open?: boolean;
  testId?: string;
}

const PopoverCard = ({ trigger, title, meta, children, width = 360, align = 'end', onOpenChange, open, testId }: PopoverCardProps) => (
  <Popover.Root open={open} onOpenChange={onOpenChange}>
    <Popover.Trigger asChild>{trigger}</Popover.Trigger>
    <Popover.Portal>
      {/* Never taller than the room under the trigger — a long card scrolls inside itself */}
      <Popover.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className={`${CARD} p-0 outline-none overflow-y-auto overscroll-contain`}
        style={{ width, maxHeight: 'var(--radix-popover-content-available-height)' }}
        data-popover-card={testId ?? title}
        /* the dialog's name (the audit: a reader's screen reader met an unnamed dialog) */
        aria-label={title}
      >
        {title && (
          <div className="flex items-baseline gap-2 px-3 pt-2.5 pb-2 border-b border-borderSubtle/70">
            <span className="font-mono text-[11px] font-semibold text-textSecondary">{title}</span>
            {meta && <span className="ml-auto font-mono text-[11px] text-textMuted tnum">{meta}</span>}
          </div>
        )}
        {children}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
);

export default PopoverCard;
