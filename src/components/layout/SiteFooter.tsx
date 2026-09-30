/*
==================================================
  SLAYER TERMINAL - SITE FOOTER
  The landing page's footer, extracted so it ends
  EVERY main page (Noah, 2026-08-23) — AppShell
  renders it under the routed content; the landing
  keeps its own copy with `home` behavior.

  `home` changes only the link plumbing, never the
  look: on the landing, #pricing/#faq are in-page
  anchors and every door into the terminal plays the
  launch gate; in the terminal they route back to the
  landing's sections and the doors are plain
  navigations.
==================================================
*/

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLaunch } from './LaunchTransition';

/* THE LINKS, WALKED (2026-09-19). What was wrong: "Launch Terminal" and "Log in / Sign up" both went to "/", the front page
   — on the front page itself they did nothing, and there is no sign-in to go to yet; "Pulse" was listed twice; Terrain, a
   whole product, was not listed at all; "FAQ" is called Questions everywhere else. Now every row goes where it says, the
   products are the side rail's own, in its order, and the sign-in row comes back WITH the sign-in (launch). */
const FOOTER_COLS = [
  {
    title: 'Products',
    links: [
      { label: 'Compass', to: '/compass' },
      { label: 'Weigher', to: '/weigher' },
      { label: 'Trace', to: '/trace' },
      { label: 'Pulse', to: '/pulse' },
      { label: 'Terrain', to: '/terrain' },
      { label: 'Pinpoint', to: '/pinpoint' },
      { label: 'Dossier', to: '/dossier' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Pricing', to: '#pricing' },
      { label: 'Questions', to: '#faq' },
      { label: 'Community', to: '/community' },
      { label: 'Contact', to: 'mailto:info@slayerterminal.com' },
    ],
  },
  {
    title: 'Terminal',
    links: [
      { label: 'Launch terminal', to: '/pulse' },
      { label: 'Tracker', to: '/compass/tracker' },
      { label: 'Settings', to: '/settings' },
      { label: 'Keyboard shortcuts', to: '/settings/keyboard' },
      { label: 'Front page', to: '/' },
    ],
  },
];

/** Anchor / route / mailto — one link component so the columns stay
    declarative. Landing gates /pulse behind the launch transition; in-app,
    hash links carry the reader back to the landing's section. */
const FooterLink = ({
  to,
  home,
  className,
  children,
}: {
  to: string;
  home: boolean;
  className: string;
  children: ReactNode;
}) => {
  const { launch } = useLaunch();
  if (to.startsWith('mailto:')) {
    return (
      <a href={to} className={className}>
        {children}
      </a>
    );
  }
  if (to.startsWith('#')) {
    return home ? (
      <a href={to} className={className}>
        {children}
      </a>
    ) : (
      <Link to={`/${to}`} className={className}>
        {children}
      </Link>
    );
  }
  /* on the front page, "Front page" is the way back to its top */
  if (to === '/' && home) {
    return (
      <a
        href="/"
        className={className}
        onClick={e => {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        {children}
      </a>
    );
  }
  /* from the front page every door into the terminal plays the launch gate — it was only Pulse's, and the other
     products cut straight to a half-loaded page */
  if (home) {
    return (
      <a
        href={to}
        className={className}
        onClick={e => {
          e.preventDefault();
          launch(to);
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
};

const SiteFooter = ({ home = false }: { home?: boolean }) => (
  /* shrink-0: on the Weigher the footer shares a definite-height flex column
     with a full-viewport desk — left shrinkable, flexbox would absorb the
     whole deficit HERE and silently collapse the footer to nothing. */
  <footer className="shrink-0 border-t border-borderSubtle">
    <div className="px-6 md:px-10 py-14 max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-10">
      <div className="col-span-2">
        <span className="font-mono text-[13px] font-bold">
          <span className="text-textMuted">&gt; </span>
          <span className="text-textPrimary">slayer_terminal</span>
          <span className="inline-block w-[6px] h-[12px] ml-1 bg-textPrimary align-middle animate-cursor-blink" />
        </span>
        <p className="mt-3 text-[12px] text-textSecondary leading-relaxed max-w-[36ch]">
          The trading terminal. Compass finds the setup, Pinpoint reads the flow.
        </p>
        <a
          href="https://x.com/JoinSlayer"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] text-textSecondary hover:text-textPrimary transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          @JoinSlayer
        </a>
      </div>
      {FOOTER_COLS.map(col => (
        <div key={col.title}>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-textMuted">
            {col.title}
          </span>
          <ul className="mt-3.5 flex flex-col gap-2.5">
            {col.links.map(l => (
              <li key={l.label}>
                <FooterLink
                  to={l.to}
                  home={home}
                  className="text-[12px] text-textSecondary hover:text-textPrimary transition-colors"
                >
                  {l.label}
                </FooterLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="border-t border-borderSubtle/60">
      <div className="px-6 md:px-10 py-5 max-w-6xl mx-auto flex flex-col md:flex-row gap-2 md:items-center">
        <span className="font-mono text-[10px] uppercase tracking-wider text-textMuted">
          {/* the year is the calendar's, not a number typed once (2026-09-19) — it read 2026 by hand and would have on 1 January too */}
          © {new Date().getFullYear()} Slayer Terminal · Compass · Pinpoint
        </span>
        <span className="md:ml-auto font-mono text-[10px] tracking-wide text-textMuted">
          For informational purposes only. Not investment advice. Preview data is simulated.
        </span>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
