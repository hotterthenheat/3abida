/*
==================================================
  SLAYER TERMINAL - THE PAGES OUTSIDE THE TERMINAL (pages/outside/OutsideFrame.tsx)

  About, status, the legal pages, the account forms, an invite: pages that stand on their own, outside the terminal's
  rail. The wordmark home on the left, then "Sign in", the theme and "Launch terminal" on the right, the brand's footer
  under them — on every one.

  THE LANDING'S GROUND (2026-10-09, the audit's OU-T1): a visitor on a light machine stood on a light landing, pressed
  "Sign up free" and landed on a black form. These pages stand on the same ground as the landing — the visitor's stored
  choice, else their machine's (landing/ground.tsx) — and carry the landing's theme button, which keeps its pick for the
  whole site.
==================================================
*/

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import Wordmark from '../../brand/Wordmark';
import SiteFooter from '../../components/layout/SiteFooter';
import { useLaunch } from '../../components/layout/LaunchTransition';
import SkipLink, { CONTENT_ID } from '../../components/ui/SkipLink';
import { GroundProvider, useGround } from '../landing/ground';

/** A door into the terminal. "Launch terminal" wears the foil on black and the ink on paper (index.css .launch-pill) —
    "Holographic silver · in the S and on Launch terminal only" — every other door into it is the page's plain ink pill.
    Two heights (the audit's OU-K1): 44 for a door on a page, 48 for a full-width one; the header's small one keeps 36 to
    the eye and a finger's 44 round it (`.hit`). */
export const LaunchPill = ({ label = 'Launch terminal', short, to = '/pulse', size = 'sm', className = '' }: { label?: string; short?: string; to?: string; size?: 'sm' | 'lg' | 'block'; className?: string }) => {
  const { launch } = useLaunch();
  return (
    <a
      href={to}
      onClick={e => {
        e.preventDefault();
        launch(to);
      }}
      className={`${label === 'Launch terminal' ? 'launch-pill' : 'bg-textPrimary text-canvas hover:bg-textPrimary/90'} hit inline-flex items-center justify-center rounded-full font-medium whitespace-nowrap ${
        size === 'sm' ? 'h-9 px-4 text-[13px]' : size === 'lg' ? 'h-11 px-6 text-[14px]' : 'h-12 w-full text-[15px]'
      } ${className}`}
      data-outside-door="launch"
    >
      {short ? (
        <>
          <span className="sm:hidden">{short}</span>
          <span className="hidden sm:inline">{label}</span>
        </>
      ) : (
        label
      )}
    </a>
  );
};

/** THE THEME BUTTON, as the landing's bar has it: it names what it does, and the pick is the whole site's */
const ThemeButton = () => {
  const { a, choose } = useGround();
  return (
    <button
      type="button"
      onClick={() => choose(a === 'dark' ? 'light' : 'dark')}
      className="hit h-9 w-9 inline-flex items-center justify-center rounded-full text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
      aria-label={a === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
      title={a === 'dark' ? 'Light theme' : 'Dark theme'}
      data-outside-theme={a}
    >
      {a === 'dark' ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
    </button>
  );
};

/* THE FOOTER ON EVERY PAGE (2026-10-03 — the owner: "make sure the art footer is on every page"): the account forms, an
   invite and maintenance went without it until then. The page's own first screen stays what it was — main is at least the
   window under the header, so a card that stood in its middle still does — and the footer, the page's own picture
   (components/layout/footer/scenes.ts), is one scroll below it. A DOCUMENT (a legal page) is as long as its words, and
   the footer follows them (`fill={false}` — the audit's OU-L1: a short document stood three quarters empty). */
const Frame = ({ children, testId, fill }: { children: ReactNode; testId?: string; fill: boolean }) => (
  <div className="min-h-screen bg-canvas text-textPrimary flex flex-col" data-outside={testId}>
    <SkipLink />
    <header className="shrink-0 h-16 flex items-center gap-2 sm:gap-3 px-5 sm:px-8">
      <Link to="/" aria-label="Slayer Terminal, the front page" className="hit inline-flex">
        <Wordmark height={14} cursor label="" />
      </Link>
      <Link to="/signin" className="hit ml-auto hidden sm:inline-flex items-center h-9 px-3 rounded-full text-[13px] text-textSecondary hover:text-textPrimary transition-colors" data-outside-door="signin">
        Sign in
      </Link>
      <span className="ml-auto sm:ml-0 inline-flex">
        <ThemeButton />
      </span>
      <LaunchPill short="Launch" />
    </header>
    <main id={CONTENT_ID} tabIndex={-1} className={`flex-1 flex flex-col outline-none ${fill ? 'min-h-[calc(100dvh-4rem)]' : ''}`}>
      {children}
    </main>
    <SiteFooter />
  </div>
);

const OutsideFrame = ({ children, testId, fill = true }: { children: ReactNode; testId?: string; fill?: boolean }) => (
  <GroundProvider>
    <Frame testId={testId} fill={fill}>
      {children}
    </Frame>
  </GroundProvider>
);

export default OutsideFrame;
