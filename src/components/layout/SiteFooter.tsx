/*
==================================================
  SLAYER TERMINAL - SITE FOOTER
  The landing page's footer, extracted so it ends
  EVERY main page (Noah, 2026-08-23) — AppShell
  renders it under the routed content; the landing
  keeps its own copy with `home` behavior.

  `home` changes the link plumbing — on the landing,
  #pricing/#faq are in-page anchors and every door into
  the terminal plays the launch gate; in the terminal
  they route back to the landing's sections and the
  doors are plain navigations — and the picture: the
  landing's is every product at once and moves whenever
  it is seen; every other page's is its own and stands
  still until a hand is on it (FooterArt, footer/).
==================================================
*/

import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLaunch } from './LaunchTransition';
import Wordmark from '../../brand/Wordmark';
import Signature from '../../brand/Signature';
import { PRODUCTS } from '../../brand/products';
import { COMPANY, filled } from '../../data/company';
import { VERSION } from '../../data/release';
import FooterArt from './FooterArt';
import { sceneFor } from './footer/registry';
import { useAlertsDrawer } from '../../data/alertsDrawer';
import { useUnit } from '../../pages/landing/scale';

/* THE LINKS, WALKED (2026-09-19): every row goes where it says. THE BRAND'S FOOTER (Slayer Logo System, 14 · the footer,
   2026-09-30): the products in the menu's order, the company, the legal pages and the one social handle. Laid as three
   stacks (2026-10-03, the footer brought to half its height): the products four abreast — a row a group — the company with
   the handle under it, and the legal pages. */
type FooterCol = { title: string; links: { label: string; to: string }[] };
const PRODUCTS_COL: FooterCol = {
  title: 'Products',
  links: PRODUCTS.map(p => ({ label: p.name, to: p.path })),
};
const FOOTER_STACKS: FooterCol[][] = [
  [PRODUCTS_COL],
  [
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
      title: 'Social',
      links: [{ label: `${COMPANY.handle} on X`, to: COMPANY.x }],
    },
  ],
  [
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
  ],
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

/** The footer's column: the landing's own (Landing.tsx Wrap — as wide as a window the screen holds whole, index.css
    --landing-col), so its edges line up with the page above; 1240 px under every other page. Never under 1040 px: on a
    short laptop screen the landing's column narrows below the room the words, the links and the picture need side by
    side, and the footer would stack to half as tall again — there it runs a little wider than the page above it. Its
    sizes are in rem: the same px as ever on every page, and on the landing they grow with a big screen as the page does
    (pages/landing/scale.ts). */
const COLUMN = 'mx-auto w-full max-w-[max(var(--landing-col,77.5rem),65rem)] px-4 sm:px-6 lg:px-10';

/* THE FOOTER IS ONE PIECE (2026-10-03 — the owner, of the footer with the photograph live at its foot: "i want that
   glitchy thing and the footer to be ONE not the art work and then the footer i want it as one art piece"): the whole
   footer is the terminal caught in the dark (FooterArt), and its words are on that screen — the wordmark and its line,
   the links in the screen's panels, the status line at its foot. The picture stands in the box marked for it
   ([data-footer-scene]); the art frames the panels ([data-footer-panel]) and lights the words ([data-footer-lit]) where
   the pointer is. Beside the words on a desk, between them on a phone.
   ON EVERY PAGE, EACH ITS OWN PICTURE (the same day — the owner: "make sure the art footer is on every page … each page
   had its own art work … thats representive of its page … and then the landing page one you go into more depth"): the
   address picks the picture (footer/registry.ts); the landing's is every product at once, and moves whenever it is on
   screen; everywhere else the picture stands still until a hand is on it. The alerts have no page of their own — they
   are a drawer over any page — so while it is open the footer under it is theirs. */
const SiteFooter = ({ home = false }: { home?: boolean }) => {
  const { pathname } = useLocation();
  const alerts = useAlertsDrawer();
  const scene = home ? 'landing' : alerts ? 'alerts' : sceneFor(pathname);
  /* the wordmark is drawn to a size in px: on the landing, at the landing's scale */
  const unit = useUnit();
  const u = home ? unit : 1;
  return (
    /* shrink-0: on the Weigher the footer shares a definite-height flex column
       with a full-viewport desk — left shrinkable, flexbox would absorb the
       whole deficit HERE and silently collapse the footer to nothing. */
    <footer className="shrink-0 overflow-hidden" data-site-footer>
      <FooterArt scene={scene} live={home}>
        {/* HALF THE HEIGHT (2026-10-03 — the owner: "i think the footers are a bit big"): 734 px of a 1440 × 900 screen
            and a phone's screen and a half; the words and the links now share the left half in three short stacks, and the
            picture stands beside them as tall as they are */}
        <div className={`${COLUMN} footer-sheet pt-12 lg:pt-14`}>
          <div className="footer-grid">
            <div className="self-start" data-footer-panel>
              <Wordmark height={13 * u} cursor label="Slayer Terminal" />
              <p className="footer-word footer-word-loud mt-4 text-[1rem] leading-[1.375rem] font-medium tracking-tight" data-footer-lit>
                Trade what you can see.
              </p>
              <p className="footer-word mt-1.5 text-[0.78125rem] leading-relaxed max-w-[48ch]" data-footer-lit>
                Most of what moves a price is public, just scattered. Slayer gathers it into one terminal.
              </p>
            </div>
            {/* THE SCREEN'S CHART: an empty box the art draws its pane, its ladder and its chips in */}
            <div aria-hidden="true" data-footer-scene />
            <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-7">
              {FOOTER_STACKS.map(stack => (
                <div key={stack[0].title} className="flex flex-col gap-5">
                  {stack.map(col => (
                    /* THE LINKS ANSWER THE POINTER (2026-10-02, from the same notes): a link under the pointer drops the rest of
                       its column a tier and comes forward with a short mark in front of it (index.css, .footer-col) */
                    <div key={col.title} className="footer-col" data-footer-panel>
                      <span className="footer-word footer-word-quiet block text-[0.6875rem] leading-[0.875rem] uppercase tracking-[0.14em]" data-footer-lit>
                        {col.title}
                      </span>
                      <ul className={`mt-3 grid gap-x-4 gap-y-2 text-[0.78125rem] leading-[1.125rem] ${col === PRODUCTS_COL ? 'grid-cols-4' : ''}`}>
                        {col.links.map(l => (
                          <li key={l.label}>
                            <FooterLink to={l.to} home={home && !OUTSIDE.test(l.to)} className="footer-word footer-link whitespace-nowrap">
                              <span className="footer-link-mark" aria-hidden="true" />
                              <span className="footer-link-words">{l.label}</span>
                            </FooterLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </nav>
          </div>
        </div>
        {/* THE STATUS LINE, at the screen's foot: the signature, what this is not, and whose it is */}
        <div className={`${COLUMN} mt-10 lg:mt-12`}>
          <div className="border-t border-ink/[0.1] py-4 flex flex-wrap items-center gap-x-10 gap-y-2">
            <Signature detail={`· ${VERSION}`} rule={false} className="text-[0.6875rem]" />
            <p className="footer-word footer-word-quiet order-last lg:order-none basis-full lg:basis-auto max-w-[92ch] text-[0.75rem] leading-relaxed" data-footer-lit>
              Slayer Terminal is not investment advice. Nothing here tells you what to buy or sell.
            </p>
            <span className="footer-word footer-word-quiet ml-auto text-[0.6875rem] whitespace-nowrap" data-footer-lit>
              {/* the year is the calendar's, not a number typed once (2026-09-19); the name and the address once they are filled */}©{' '}
              {new Date().getFullYear()} {filled(COMPANY.legalName) ?? COMPANY.product}
              {filled(COMPANY.address) && ` · ${COMPANY.address}`}
            </span>
          </div>
        </div>
      </FooterArt>
    </footer>
  );
};

export default SiteFooter;
