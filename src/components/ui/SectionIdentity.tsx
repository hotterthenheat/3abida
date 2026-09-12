/*
==================================================
  SLAYER TERMINAL - SECTION IDENTITY (fused strips)

  The slim one-strip headers (Trace, Weigher, and
  every page that sheds its PageHeader next) lost
  their subtitles when the chrome shrank — so the
  explanation can live INSIDE the name (Noah,
  2026-08-30: "a brief but informative sentence
  emerges from within the word 'Weigher' and
  slides to the right of it smoothly... on the
  same horizontal plane... not form more words
  under it").
==================================================

  WHISPER IS OPT-OUT PER STRIP. The Weigher keeps its reveal (Noah,
  2026-08-30: "keep it on weigher"); the Trace strip turned it off the same
  day ("remove the entire animation for everything on the top including
  the trace one") — there the tabs explain themselves with a hover card
  instead, and the identity is simply the word.

  MECHANICS live in ui/Whisper — the framer-motion reveal (transform and
  opacity only). Keyboard users get the same reveal on focus.

  ONE SOURCE. Icon, name and sentence all come from NAV_ITEMS — the same
  registry the top-bar menus speak from — so the hover whisper can never
  drift from what the nav already says the page is.
*/

import { NAV_ITEMS } from '../layout/nav';
import { Whisper, useWhisper } from './Whisper';

interface Props {
  path: string;
  /** Slide the section's one-liner out of the word on hover/focus. */
  whisper?: boolean;
}

const SectionIdentity = ({ path, whisper = true }: Props) => {
  const { open, host } = useWhisper();
  const item = NAV_ITEMS.find(i => i.path === path);
  if (!item) return null;
  const Icon = item.icon;
  return (
    <div
      tabIndex={whisper ? 0 : undefined}
      {...(whisper ? host : {})}
      className="flex items-center gap-2 shrink-0 min-w-0 outline-none cursor-default"
    >
      <span className="inline-flex w-5 h-5 rounded-md border border-borderSubtle bg-inset items-center justify-center shrink-0">
        <Icon className="w-3 h-3 text-textSecondary" />
      </span>
      <h1 className="text-sm font-semibold tracking-tight text-textPrimary leading-none whitespace-nowrap">
        {item.label}
      </h1>
      {whisper && (
        <Whisper open={open} className="pl-1 text-xs text-textSecondary">
          {item.description}
        </Whisper>
      )}
    </div>
  );
};

export default SectionIdentity;
