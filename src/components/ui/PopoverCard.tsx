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
  testId?: string;
}

const PopoverCard = ({ trigger, title, meta, children, width = 360, align = 'end', onOpenChange, testId }: PopoverCardProps) => (
  <Popover.Root onOpenChange={onOpenChange}>
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
      >
        {title && (
          <div className="flex items-baseline gap-2 px-3 pt-2.5 pb-2 border-b border-borderSubtle/70">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-textSecondary">{title}</span>
            {meta && <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted tnum">{meta}</span>}
          </div>
        )}
        {children}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
);

export default PopoverCard;
