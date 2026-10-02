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

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLaunch } from './LaunchTransition';
import Wordmark from '../../brand/Wordmark';
import { WORDMARK } from '../../brand/wordmarkPaths';
import { alignBrandLoops } from '../../brand/brandClock';
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

/** The footer's column: the landing's own (Landing.tsx Wrap), so every edge of the footer lines up with the page above */
const COLUMN = 'mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10';

/** how much of the wordmark stands above the page's bottom edge */
const SHOWN = 0.64;

/* THE FLOOR (2026-10-02 — the owner: "fix the live footer it doesn't look clean and together"; the clean footers end on
   one object, the brand at display size cut by the page's edge — Midday, Framer's Futer): the drawn wordmark the width
   of the column, its foot below the page's last pixel, ENGRAVED in the ground — a hair of ink inside the letters and a
   hairline round them — not printed on it. Its cursor blinks on the brand's one beat (brandClock), the only thing in it
   that moves. The letters are the brand's own outlines (wordmarkPaths.ts); only the paint is the floor's. */
const FooterFloor = () => {
  const cursor = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    alignBrandLoops(cursor.current);
  }, []);
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden select-none pointer-events-none"
      style={{ aspectRatio: `${WORDMARK.width} / ${(WORDMARK.height * SHOWN).toFixed(2)}` }}
      data-footer-floor
    >
      <svg viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`} className="absolute inset-x-0 top-0 block w-full h-auto" focusable="false">
        <g fill="rgb(var(--ink) / 0.035)" stroke="rgb(var(--ink) / 0.17)" strokeWidth={1}>
          <path d={WORDMARK.chevron} vectorEffect="non-scaling-stroke" />
          <path d={WORDMARK.slayer} vectorEffect="non-scaling-stroke" />
          <path d={WORDMARK.terminal} vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      <span
        ref={cursor}
        className="wordmark-cursor"
        style={{
          left: `${(WORDMARK.cursorX / WORDMARK.width) * 100}%`,
          width: `${(WORDMARK.cursorW / WORDMARK.width) * 100}%`,
          height: `${(99.6 / SHOWN).toFixed(2)}%`,
          background: 'rgb(var(--ink) / 0.2)',
        }}
      />
    </div>
  );
};

const SiteFooter = ({ home = false }: { home?: boolean }) => (
  /* shrink-0: on the Weigher the footer shares a definite-height flex column
     with a full-viewport desk — left shrinkable, flexbox would absorb the
     whole deficit HERE and silently collapse the footer to nothing. */
  <footer className="shrink-0 border-t border-borderSubtle overflow-hidden" data-site-footer>
    <div className={`${COLUMN} pt-14 pb-10 grid grid-cols-2 md:grid-cols-6 gap-x-10 gap-y-10`}>
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
      <div className={`${COLUMN} py-6 flex flex-col gap-4`}>
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
    {/* THE LIVE END OF THE PAGE (2026-10-02 — the owner: "make it super cool like a live footer", then, of the first try,
        "it doesn't look clean and together"): the line and its echoes, drawn live (FooterArt), standing on the wordmark
        cut by the page's edge (FooterFloor) — one object, in the column every other edge of the footer keeps. Taller on
        the front page. */}
    <div className={COLUMN}>
      <FooterArt className={home ? 'h-[170px] md:h-[230px]' : 'h-[130px] md:h-[170px]'} />
      <FooterFloor />
    </div>
  </footer>
);

export default SiteFooter;
