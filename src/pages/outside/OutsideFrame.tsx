/*
==================================================
  SLAYER TERMINAL - THE PAGES OUTSIDE THE TERMINAL (pages/outside/OutsideFrame.tsx)

  About, status, the legal pages, the account forms, an invite: pages that stand on their own, outside the terminal's
  rail. The wordmark home on the left, "Launch terminal" on the right, the brand's footer under them — on every one.
==================================================
*/

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Wordmark from '../../brand/Wordmark';
import SiteFooter from '../../components/layout/SiteFooter';
import { useLaunch } from '../../components/layout/LaunchTransition';

/** A door into the terminal. "Launch terminal" wears the foil on black and the ink on paper (index.css .launch-pill) —
    "Holographic silver · in the S and on Launch terminal only" — every other door into it is the page's plain ink pill */
export const LaunchPill = ({ label = 'Launch terminal', to = '/pulse', size = 'sm', className = '' }: { label?: string; to?: string; size?: 'sm' | 'lg' | 'block'; className?: string }) => {
  const { launch } = useLaunch();
  return (
    <a
      href={to}
      onClick={e => {
        e.preventDefault();
        launch(to);
      }}
      className={`${label === 'Launch terminal' ? 'launch-pill' : 'bg-textPrimary text-canvas hover:bg-textPrimary/90'} inline-flex items-center justify-center rounded-full font-medium whitespace-nowrap ${
        size === 'sm' ? 'h-9 px-4 text-[13px]' : size === 'lg' ? 'h-11 px-6 text-[14px]' : 'h-12 w-full text-[15px]'
      } ${className}`}
      data-outside-door="launch"
    >
      {label}
    </a>
  );
};

/* THE FOOTER ON EVERY PAGE (2026-10-03 — the owner: "make sure the art footer is on every page"): the account forms, an
   invite and maintenance went without it until then. The page's own first screen stays what it was — main is at least the
   window under the header, so a card that stood in its middle still does — and the footer, the page's own picture
   (components/layout/footer/scenes.ts), is one scroll below it. */
const OutsideFrame = ({ children, testId }: { children: ReactNode; testId?: string }) => (
  <div className="min-h-screen bg-canvas text-textPrimary flex flex-col" data-outside={testId}>
    <header className="shrink-0 h-16 flex items-center gap-4 px-5 sm:px-8">
      <Link to="/" aria-label="Slayer Terminal, the front page" className="inline-flex">
        <Wordmark height={14} cursor label="" />
      </Link>
      <LaunchPill className="ml-auto" />
    </header>
    <main className="flex-1 flex flex-col min-h-[calc(100dvh-4rem)]">{children}</main>
    <SiteFooter />
  </div>
);

export default OutsideFrame;
