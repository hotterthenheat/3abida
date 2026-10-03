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

import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLaunch } from './LaunchTransition';
import Wordmark from '../../brand/Wordmark';
import Signature from '../../brand/Signature';
import { PRODUCTS } from '../../brand/products';
import { COMPANY, filled } from '../../data/company';
import { VERSION } from '../../data/release';
import FooterArt from './FooterArt';

/* THE LINKS, WALKED (2026-09-19): every row goes where it says. THE BRAND'S FOOTER (Slayer Logo System, 14 · the footer,
   2026-09-30): the products in the menu's order, the company, the legal pages and the one social handle. */
const FOOTER_COLS = [
  {
    title: 'Products',
    links: PRODUCTS.map(p => ({ label: p.name, to: p.path })),
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Press', to: `mailto:${COMPANY.press}` },
      { label: 'Contact', to: `mailto:${COMPANY.info}` },
      { label: 'Status', to: '/status' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', to: '/legal/terms' },
      { label: 'Privacy', to: '/legal/privacy' },
      { label: 'Risk disclosure', to: '/legal/risk' },
      { label: 'Refund policy', to: '/legal/refunds' },
      { label: 'Data sources', to: '/legal/data' },
    ],
  },
  {
    title: 'Social',
    links: [{ label: `${COMPANY.handle} on X`, to: COMPANY.x }],
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
  if (to.startsWith('https:')) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={className} data-footer-lit>
        {children}
      </a>
    );
  }
  if (to.startsWith('mailto:')) {
    return (
      <a href={to} className={className} data-footer-lit>
        {children}
      </a>
    );
  }
  if (to.startsWith('#')) {
    return home ? (
      <a href={to} className={className} data-footer-lit>
        {children}
      </a>
    ) : (
      <Link to={`/${to}`} className={className} data-footer-lit>
        {children}
      </Link>
    );
  }
  /* on the front page, "Front page" is the way back to its top */
  if (to === '/' && home) {
    return (
      <a
        href="/"
        className={className} data-footer-lit
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
        className={className} data-footer-lit
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
    <Link to={to} className={className} data-footer-lit>
      {children}
    </Link>
  );
};

/** The pages outside the terminal (the front page's legal and company pages, the status page): a door there is a plain
    link, not the launch gate */
const OUTSIDE = /^\/(about|status|legal)/;

/** The footer's column: the landing's own (Landing.tsx Wrap), so every edge of the footer lines up with the page above */
const COLUMN = 'mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10';

/* THE FOOTER IS ONE PIECE (2026-10-03 — the owner, of the footer with the photograph live at its foot: "i want that
   glitchy thing and the footer to be ONE not the art work and then the footer i want it as one art piece"): the whole
   footer is the terminal caught in the dark (FooterArt), and its words are on that screen — the wordmark and its line,
   the links in the screen's panels, the status line at its foot. The chart stands in the box marked for it
   ([data-footer-scene]); the art frames the panels ([data-footer-panel]) and lights the words ([data-footer-lit]) where
   the pointer is. Beside the words on a desk, between them on a phone. */
const SiteFooter = ({ home = false }: { home?: boolean }) => (
  /* shrink-0: on the Weigher the footer shares a definite-height flex column
     with a full-viewport desk — left shrinkable, flexbox would absorb the
     whole deficit HERE and silently collapse the footer to nothing. */
  <footer className="shrink-0 overflow-hidden" data-site-footer>
    <FooterArt>
      <div className={`${COLUMN} pt-20 lg:pt-24`}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10">
          <div className="lg:col-span-5 self-start" data-footer-panel>
            <Wordmark height={14} cursor label="Slayer Terminal" />
            <p className="footer-word footer-word-loud mt-5 text-[17px] font-medium tracking-tight" data-footer-lit>
              Trade what you can see.
            </p>
            <p className="footer-word mt-2 text-[13px] leading-relaxed max-w-[38ch]" data-footer-lit>
              Most of what moves a price is public, just scattered. Slayer gathers it into one terminal.
            </p>
          </div>
          {/* THE SCREEN'S CHART: an empty box the art draws its pane, its ladder and its chips in */}
          <div aria-hidden="true" className="lg:col-span-7 lg:row-span-2 h-[190px] sm:h-[230px] lg:h-auto lg:min-h-[320px]" data-footer-scene />
          <nav aria-label="Footer" className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-9">
            {FOOTER_COLS.map(col => (
              /* THE LINKS ANSWER THE POINTER (2026-10-02, from the same notes): a link under the pointer drops the rest of its
                 column a tier and comes forward with a short mark in front of it (index.css, .footer-col) */
              <div key={col.title} className={`footer-col ${col.title === 'Products' ? 'col-span-2' : ''}`} data-footer-panel>
                <span className="footer-word footer-word-quiet text-[11px] uppercase tracking-[0.14em]" data-footer-lit>
                  {col.title}
                </span>
                <ul className={`mt-3.5 grid gap-x-6 gap-y-2.5 ${col.title === 'Products' ? 'grid-cols-2' : ''}`}>
                  {col.links.map(l => (
                    <li key={l.label}>
                      <FooterLink to={l.to} home={home && !OUTSIDE.test(l.to)} className="footer-word footer-link text-[13px]">
                        <span className="footer-link-mark" aria-hidden="true" />
                        <span className="footer-link-words">{l.label}</span>
                      </FooterLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>
      {/* THE STATUS LINE, at the screen's foot: the signature, what this is not, and whose it is */}
      <div className={`${COLUMN} mt-16 lg:mt-20`}>
        <div className="border-t border-ink/[0.1] py-6 flex flex-col lg:flex-row gap-3 lg:items-center lg:gap-10">
          <Signature detail={`· ${VERSION}`} rule={false} className="text-[11px]" />
          <p className="footer-word footer-word-quiet max-w-[92ch] text-[12px] leading-relaxed" data-footer-lit>
            Slayer Terminal is not investment advice. Nothing here tells you what to buy or sell.
          </p>
          <span className="footer-word footer-word-quiet lg:ml-auto text-[11px] whitespace-nowrap" data-footer-lit>
            {/* the year is the calendar's, not a number typed once (2026-09-19); the name and the address once they are filled */}©{' '}
            {new Date().getFullYear()} {filled(COMPANY.legalName) ?? COMPANY.product}
            {filled(COMPANY.address) && ` · ${COMPANY.address}`}
          </span>
        </div>
      </div>
    </FooterArt>
  </footer>
);

export default SiteFooter;
