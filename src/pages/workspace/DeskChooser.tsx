/*
==================================================
  SLAYER TERMINAL - START FROM A DESK
  (pages/workspace/DeskChooser.tsx)

  The ideas report's "start from a desk" (2026-10-10;
  Robinhood Legend's template-or-scratch choice — and
  a chooser beats a tour, whose checklists are finished
  one time in ten): the very first time the terminal
  opens, with no desk of the reader's on this machine,
  Pulse offers its four presets as a quiet row, one
  line each. A pick puts that desk up; the × keeps the
  one on screen. Either way it never comes back.

  "First" is decided once, the first time this module
  is read and before Pulse writes its desks: no desk
  stored and none of the old single desk either. Then
  the chooser stands, across reloads, until it is
  answered (slayer_desk_chooser). Never inside the
  landing's window — its films set their own desk.
==================================================
*/

import { useState } from 'react';
import { X } from 'lucide-react';
import { EMBEDDED } from '../../embed';
import { DESKS_KEY, PRESET_NAMES } from './desks';

const CHOOSER_KEY = 'slayer_desk_chooser';
const LEGACY_KEY = 'slayer_workspace_v1';

/** One line a desk — what it puts on the screen */
const LINES: Record<string, string> = {
  'Market Structure': 'The chart, the strike ladder and the book by strike, side by side.',
  'The Day Ahead': 'The range, where it closes, the agenda and the wall — now to the bell.',
  Flow: 'The chart beside the wire, where the walls are heading, and the setups.',
  '0DTE': 'Today’s expiry: the ladder large, where the day closes, the book beneath.',
};

/* read once, at import — before Pulse saves its first desk */
const pending: boolean = (() => {
  if (EMBEDDED || typeof window === 'undefined') return false;
  try {
    const said = localStorage.getItem(CHOOSER_KEY);
    if (said === 'done') return false;
    if (said === 'open') return true;
    const fresh = !localStorage.getItem(DESKS_KEY) && !localStorage.getItem(LEGACY_KEY);
    localStorage.setItem(CHOOSER_KEY, fresh ? 'open' : 'done');
    return fresh;
  } catch {
    return false;
  }
})();

const answer = () => {
  try {
    localStorage.setItem(CHOOSER_KEY, 'done');
  } catch {
    /* storage off — it goes for this visit */
  }
};

const DeskChooser = ({ active, onPick }: { active: string; onPick: (name: string) => void }) => {
  const [open, setOpen] = useState(pending);
  if (!open) return null;
  const close = () => {
    answer();
    setOpen(false);
  };
  return (
    <section aria-labelledby="desk-chooser-title" className="rounded-md border border-borderSubtle bg-panel px-4 py-3" data-desk-chooser>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="desk-chooser-title" className="text-[13px] font-semibold text-textPrimary">
            Start from a desk
          </h2>
          <p className="mt-0.5 text-[11px] text-textMuted">Four ready arrangements of Pulse’s panels. Any desk can be changed, saved under your own name, or put back.</p>
        </div>
        <button type="button" onClick={close} aria-label={`Keep ${active} and close this`} title={`Keep ${active}`} className="hit shrink-0 p-1 -mr-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06]" data-desk-chooser-close>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {PRESET_NAMES.map(name => (
          <li key={name}>
            <button
              type="button"
              onClick={() => {
                onPick(name);
                close();
              }}
              aria-current={active === name ? 'true' : undefined}
              className={`w-full h-full text-left rounded-md border px-3 py-2.5 transition-colors ${
                active === name ? 'border-borderMuted bg-ink/[0.05]' : 'border-borderSubtle hover:border-borderMuted hover:bg-ink/[0.03]'
              }`}
              data-desk-choice={name}
            >
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-textPrimary">
                {name}
                {active === name && <span className="font-normal text-[11px] text-textMuted">· on screen</span>}
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-textSecondary">{LINES[name] ?? ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default DeskChooser;
