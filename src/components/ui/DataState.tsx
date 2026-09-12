import { AlertTriangle, Loader2, Inbox, CloudOff } from 'lucide-react';
import type { ReactNode } from 'react';

/*
==================================================
  SLAYER TERMINAL - THE FOUR NON-ANSWERS
  (components/ui/DataState.tsx)
==================================================

  Every panel on this desk can be in one of four states that are NOT "here
  is your number", and before this each screen invented its own rendering
  for them — a bare string, a dashed box, a spinner, or nothing at all.
  Section 24 asks that every page have a deliberate loading and empty state;
  this is the one place they are defined so that "deliberate" can mean
  "consistent" rather than "individually decided, forty times".

  THE FOUR ARE DIFFERENT ANSWERS AND MUST NOT LOOK ALIKE:

    loading      the answer is coming — the only one that should animate
    empty        the question is fine, the answer is legitimately nothing.
                 A tape with no prints over $1M is EMPTY, not broken, and
                 the copy should say what would put something here
    unavailable  we cannot answer — no source, not on this plan, not for
                 this ticker. Never dressed as empty, because empty invites
                 waiting and this does not
    error        something broke. It says so, and offers the retry

  A CONFLATED EMPTY AND UNAVAILABLE IS THE FAILURE THIS PREVENTS. A reader
  who sees "no data" for a filter that is simply too tight will widen the
  filter; one who sees it because the desk cannot answer will widen the
  filter forever. The words are chosen so those two never read the same.

  SIZE IS THE CALLER'S. A state inside a 96px stat card and one filling a
  half-page table want different air, so `pad` selects the block's height
  rather than every caller re-inventing it.
*/

export type DataStateKind = 'loading' | 'empty' | 'unavailable' | 'error';

const ICON = {
  loading: Loader2,
  empty: Inbox,
  unavailable: CloudOff,
  error: AlertTriangle,
} as const;

const TONE: Record<DataStateKind, string> = {
  loading: 'text-textMuted',
  empty: 'text-textMuted',
  unavailable: 'text-textMuted',
  error: 'text-warn',
};

const PAD = { sm: 'py-6', md: 'py-12', lg: 'py-20' } as const;

export interface DataStateProps {
  kind: DataStateKind;
  /** The headline. Defaults per kind — override when the screen can be specific. */
  title?: string;
  /** One line under it: what would put something here, or why there is nothing. */
  body?: ReactNode;
  /** Offered on `error`, and on `unavailable` when a retry could help. */
  onRetry?: () => void;
  pad?: keyof typeof PAD;
  className?: string;
}

const DEFAULT_TITLE: Record<DataStateKind, string> = {
  loading: 'Loading',
  empty: 'Nothing here',
  unavailable: 'Not available',
  error: 'Something broke',
};

const DataState = ({ kind, title, body, onRetry, pad = 'md', className = '' }: DataStateProps) => {
  const Icon = ICON[kind];
  return (
    <div
      /* `status` rather than `alert`: these appear on render and an alert
         role would interrupt a screen reader mid-sentence on every mount. */
      role="status"
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
      className={`flex flex-col items-center justify-center gap-2 px-6 text-center ${PAD[pad]} ${className}`}
    >
      <Icon
        size={18}
        strokeWidth={1.5}
        className={`${TONE[kind]} ${kind === 'loading' ? 'animate-spin' : ''}`}
        aria-hidden
      />
      <span className={`font-mono text-[11px] uppercase tracking-widest ${TONE[kind]}`}>
        {title ?? DEFAULT_TITLE[kind]}
      </span>
      {body && <span className="text-[11px] text-textMuted leading-snug max-w-[52ch]">{body}</span>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary border border-borderSubtle rounded px-2 py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          Try again
        </button>
      )}
    </div>
  );
};

export default DataState;
