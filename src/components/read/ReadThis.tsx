/*
==================================================
  SLAYER TERMINAL - READ THIS (components/read/ReadThis.tsx)

  The ideas report's item 12, from templates only
  (2026-10-10 — the owner: "no LLMs tho please"): a
  small door on a panel that turns what the panel
  already computes into three plain sentences —

    on the panel now     what is observed, in its
                         own figures
    what it assumes      what the model stands on
                         (a panel of observed
                         figures says so)
    what would change it the figures that would turn
                         the read, named

  Every sentence is a template filled with the
  panel's numbers (data/reads.ts); where a room
  already writes a sentence, the read reuses it. A
  read, never an instruction, never a trade call.

  The panel hands a function, not the words: the
  read is built when the door opens, from the
  figures of that moment, and never on the tick.
==================================================
*/

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ScrollText } from 'lucide-react';
import { CARD } from '../ui/DropdownSelect';
import type { Reading } from '../../data/reads';

interface ReadThisProps {
  /** The read of this moment — built when the door opens; null while the panel has nothing to read */
  read: () => Reading | null;
  /** What the panel is, for the card's head: "the Map", "the wall at 480" */
  what: string;
  /** The icon alone — for a toolbar that has measured itself tight; the words stay in its label */
  compact?: boolean;
  testId: string;
  align?: 'start' | 'end' | 'center';
  className?: string;
}

const Part = ({ label, children, testId }: { label: string; children: string; testId: string }) => (
  <div className="px-3 py-2 border-t border-borderSubtle/60 first:border-t-0" data-read-part={testId}>
    <p className="text-[11px] text-textMuted">{label}</p>
    <p className="mt-0.5 text-[12px] leading-relaxed text-textPrimary">{children}</p>
  </div>
);

const Body = ({ read }: { read: () => Reading | null }) => {
  /* built once as the card opens — the figures of the moment the reader asked */
  const [r] = useState(read);
  if (!r) return <p className="px-3 py-3 text-[12px] text-textSecondary">Nothing to read yet — the panel’s figures are still coming in.</p>;
  return (
    <>
      <Part label="On the panel now" testId="observed">
        {r.observed}
      </Part>
      <Part label="What it assumes" testId="assumes">
        {r.assumes ?? 'Nothing beyond the feed: every figure here is observed or plain arithmetic on what was observed.'}
      </Part>
      <Part label="What would change it" testId="changes">
        {r.changes}
      </Part>
    </>
  );
};

const ReadThis = ({ read, what, compact = false, testId, align = 'start', className = '' }: ReadThisProps) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title={`Read this — ${what}, in three sentences: what is on it, what it assumes, what would change it`}
          aria-label={`Read this — ${what}`}
          /* on a phone the icon alone: a head there has no room for a second door's words */
          className={`hit shrink-0 inline-flex items-center gap-1 h-6 rounded-md text-[11px] text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] data-[state=open]:text-textPrimary transition-colors ${compact ? 'w-6 justify-center' : 'px-1.5 max-sm:w-6 max-sm:px-0 max-sm:justify-center'} ${className}`}
          data-read-door={testId}
        >
          <ScrollText className="w-3 h-3" aria-hidden />
          {!compact && <span className="max-sm:hidden">Read this</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className={`${CARD} p-0 outline-none overflow-y-auto overscroll-contain`}
          style={{ width: 'min(380px, calc(100vw - 24px))', maxHeight: 'var(--radix-popover-content-available-height)' }}
          aria-label={`Read this — ${what}`}
          data-read-card={testId}
        >
          <div className="px-3 pt-2.5 pb-2 border-b border-borderSubtle/70 bg-chip">
            <span className="text-[11px] font-semibold text-textSecondary">Read this · {what}</span>
          </div>
          {open && <Body read={read} />}
          <p className="px-3 py-2 border-t border-borderSubtle/70 text-[11px] leading-snug text-textMuted">Built from the panel’s own figures as it opened — a read of what is there, not advice.</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default ReadThis;
