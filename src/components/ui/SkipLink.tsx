/*
==================================================
  SLAYER TERMINAL - SKIP TO CONTENT (ui/SkipLink.tsx)

  The first thing the keys reach on every page frame
  — the terminal's shell, the landing, the pages
  outside — hidden until it has focus (the audit's
  X4.5–X4.7, 2026-10-09: from load, fifteen Tabs
  passed the rail before the page). Enter moves focus
  to the frame's <main id="content" tabIndex={-1}>,
  so the next Tab is the page's own first control.
  Sizes in rem: the landing scales its root.
==================================================
*/

/** The id every frame's <main> carries */
export const CONTENT_ID = 'content';

const SkipLink = ({ label = 'Skip to content' }: { label?: string }) => (
  <a
    href={`#${CONTENT_ID}`}
    onClick={e => {
      const main = document.getElementById(CONTENT_ID);
      if (!main) return;
      /* focus by hand rather than by the address: the router would read a new hash, and the landing reads one as a jump */
      e.preventDefault();
      main.focus({ preventScroll: true });
      main.scrollIntoView({ block: 'start' });
    }}
    className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:inline-flex focus:items-center focus:h-10 focus:px-4 focus:rounded-md focus:border focus:border-borderMuted focus:bg-panel focus:text-textPrimary focus:shadow-lg focus:shadow-black/40 text-[0.8125rem] font-medium"
    data-skip-link
  >
    {label}
  </a>
);

export default SkipLink;
