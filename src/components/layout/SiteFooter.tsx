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
      <a href={to} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
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

/** The pages outside the terminal (the front page's legal and company pages, the status page): a door there is a plain
    link, not the launch gate */
const OUTSIDE = /^\/(about|status|legal)/;

const SiteFooter = ({ home = false }: { home?: boolean }) => (
  /* shrink-0: on the Weigher the footer shares a definite-height flex column
     with a full-viewport desk — left shrinkable, flexbox would absorb the
     whole deficit HERE and silently collapse the footer to nothing. */
  <footer className="shrink-0 border-t border-borderSubtle" data-site-footer>
    {/* THE LIVE BAND (2026-10-02 — the owner: "make it super cool like a live footer", from a photograph of a chart caught
        dark and broken): the tape dissolving, drawn live (FooterArt). Taller on the front page; a strip under the terminal. */}
    <FooterArt className={home ? 'h-[200px] md:h-[280px]' : 'h-[140px] md:h-[170px]'} />
    <div className="px-6 md:px-10 pt-14 pb-10 max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-6 gap-x-10 gap-y-10">
      <div className="col-span-2">
        <Wordmark height={14} label="Slayer Terminal" />
        <p className="mt-5 text-[17px] font-medium tracking-tight text-textPrimary">Trade what you can see.</p>
        <p className="mt-2 text-[13px] text-textSecondary leading-relaxed max-w-[38ch]">
          Most of what moves a price is public, just scattered. Slayer gathers it into one terminal.
        </p>
      </div>
      {FOOTER_COLS.map(col => (
        <div key={col.title} className={col.title === 'Products' ? 'row-span-2' : ''}>
          <span className="text-[11px] uppercase tracking-[0.14em] text-textMuted">{col.title}</span>
          <ul className={`mt-3.5 grid gap-x-6 gap-y-2.5 ${col.title === 'Products' ? 'grid-cols-1' : ''}`}>
            {col.links.map(l => (
              <li key={l.label}>
                <FooterLink
                  to={l.to}
                  home={home && !OUTSIDE.test(l.to)}
                  className="text-[13px] text-textSecondary hover:text-textPrimary transition-colors"
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
      <div className="px-6 md:px-10 py-6 max-w-6xl mx-auto flex flex-col gap-4">
        <p className="max-w-[92ch] text-[12px] leading-relaxed text-textMuted">
          Slayer Terminal is not investment advice. Nothing here tells you what to buy or sell.
        </p>
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <Signature detail={`· ${VERSION}`} rule={false} className="text-[11px]" />
          <span className="md:ml-auto text-[11px] text-textMuted">
            {/* the year is the calendar's, not a number typed once (2026-09-19); the name and the address once they are filled */}©{' '}
            {new Date().getFullYear()} {filled(COMPANY.legalName) ?? COMPANY.product}
            {filled(COMPANY.address) && ` · ${COMPANY.address}`}
          </span>
        </div>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
