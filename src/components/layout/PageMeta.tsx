/*
==================================================
  SLAYER TERMINAL - EVERY PAGE'S TITLE AND DESCRIPTION
  (components/layout/PageMeta.tsx)

  Until 2026-09-19 the whole site had ONE title and
  one description — index.html's — so forty pages sat
  in a browser's tabs, its history and a search result
  under the same name. Mounted once, beside the routes,
  this gives each page its own:

    the tab       "Map · Pinpoint · Slayer Terminal" —
                  the page first, because a tab shows
                  its first dozen letters
    the search    a sentence about THAT page

  WHERE THE WORDS COME FROM. A section's pages already
  carry a plain-English subtitle under their heading
  (pinpoint · trace · record subnav.ts) — that IS the
  description, read from the same list, so the page and
  its description cannot disagree. The top-level pages
  are written here, under the house rules: plain
  English, no buzzwords, and the brand never calls
  itself an options terminal (it is market-wide).

  A link preview (X, iMessage, Slack) does not run the
  app — it reads index.html, whose tags are the
  landing's. This component keeps the Open Graph pair
  in step anyway, for the readers that do.

  An address the app does not know gets the site's own
  name and no page name — the 404 page will take that.

  A PAGE WITH WORDS OF ITS OWN (2026-09-26 — Noah, of a
  tab reading "SMUAF0FPB3X · Backtest": "what does that
  say"): an id in an address is never a title. A page
  built round one thing — a backtest session, a trade in
  the journal — says that thing's name here (`SayPage`),
  and the tab reads "SPY from Jun 29 · Backtest". Until it
  does, the parent page's own name stands; only a segment
  that looks like a ticker (NVDA, BRK.B) is read as one.
==================================================
*/

import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { GEX_SUBPAGES } from '../../pages/pinpoint/subnav';
import { TRACE_SUBPAGES } from '../../pages/trace/subnav';
import { RECORD_SUBPAGES } from '../../pages/record/subnav';
import { PRACTICE_SUBPAGES } from '../../pages/practice/subnav';

const SITE = 'Slayer Terminal';
const LANDING = {
  title: `${SITE} — Trade what you can see`,
  description: 'Most of what moves a price is public, just scattered. Slayer gathers it into one terminal: the prints, the positions, the levels, the filings. Every page explains itself in plain English.',
};

interface Meta {
  title: string;
  description: string;
}

const page = (name: string, description: string, section?: string): Meta => ({ title: `${[name, section].filter(Boolean).join(' · ')} · ${SITE}`, description });

/* the pages that stand alone */
const TOP: Record<string, Meta> = {
  '/pulse': page('Pulse', 'Your own desk of live panels: the chart, the hedging at every strike and the book across the calendar, arranged your way and kept as you left it.'),
  '/pulse/board': page('Four charts', 'Four names at once, each with its own timeframe and overlays.', 'Pulse'),
  '/terrain': page('Terrain', 'Charts and nothing in the way: one to four side by side on one set of controls, with drawing tools, your own scripts and the book beside the chart.'),
  '/compass': page('Compass', 'Contracts that fit the levels right now. Each one carries a live state: active while the structure holds, watch while it forms, fading when it breaks.'),
  '/compass/tracker': page('Tracker', 'The setups you kept, followed to the close.', 'Compass'),
  '/weigher': page('Weigher', 'Weigh any contract before you take it: the chart, the chain and your watchlist on one desk, and what a position would return at every price.'),
  '/community': page('Community', 'The traders’ room. It opens after launch.'),
};

/* each is the line the section itself wears under its heading (pages/settings/Settings.tsx) */
const SETTINGS: Record<string, string> = {
  account: 'Who you are to the terminal: your picture, your name and how you sign in.',
  billing: 'Your plan and the card behind it. The card lives with Stripe, never here.',
  data: 'What is yours on this machine (the board, the marks, the alerts, the desks, these settings) and where the feed stands.',
  appearance: 'The terminal drawn in each theme: dark, light, or whatever your machine is set to.',
  desk: 'What every desk reads by: the ruler, the name and timeframe it opens on, the chime and the clock.',
  keyboard: 'Every key the terminal answers to, by where it works.',
  about: 'The terminal and its version.',
};
const SETTINGS_NAME: Record<string, string> = { account: 'Account', billing: 'Billing', data: 'Data', appearance: 'Appearance', desk: 'The desk', keyboard: 'Keyboard', about: 'About' };

const SECTIONS: { base: string; name: string; pages: { path: string; label: string; subtitle: string }[] }[] = [
  { base: '/pinpoint', name: 'Pinpoint', pages: GEX_SUBPAGES },
  { base: '/trace', name: 'Trace', pages: TRACE_SUBPAGES },
  { base: '/dossier', name: 'Dossier', pages: RECORD_SUBPAGES },
  { base: '/practice', name: 'Practice', pages: PRACTICE_SUBPAGES },
];

/* a NAME's own page says what is on it about that name — the list page's subtitle is about every name */
const NAME_PAGE: Record<string, (name: string) => string> = {
  '/dossier/stocks': n => `The dossier on ${n}, on one page: its chart, how it screens, its news, its earnings and its filings.`,
  '/dossier/earnings': n => `${n}’s earnings: the next print, the move priced for it, and what the name has typically done.`,
};

/** A subtitle is written for under a heading ("a & b — c"); as a description it reads as a sentence */
const sentence = (s: string): string => {
  const t = s.replace(/\s&\s/g, ' and ').replace(/\s—\s/g, ': ').trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

/* ---- the words a page says of itself (the head note) ---- */
let said: string | null = null;
const saidListeners = new Set<() => void>();
export const sayPage = (words: string | null) => {
  if (words === said) return;
  said = words;
  saidListeners.forEach(fn => fn());
};
const useSaid = () =>
  useSyncExternalStore(
    fn => {
      saidListeners.add(fn);
      return () => saidListeners.delete(fn);
    },
    () => said,
    () => said
  );
/** Mounted by a page built round one thing: the tab carries its name while the page is up */
export const SayPage = ({ words }: { words: string | null | undefined }) => {
  useEffect(() => {
    sayPage(words ?? null);
    return () => sayPage(null);
  }, [words]);
  return null;
};
/** A segment of an address that is a NAME (a ticker), not an id */
const TICKER = /^[A-Za-z^][A-Za-z0-9.^-]{0,5}$/;

export function metaFor(pathname: string, own: string | null = null): Meta {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return LANDING;
  if (TOP[path]) return TOP[path];

  if (path === '/settings' || path.startsWith('/settings/')) {
    const s = path.split('/')[2] ?? 'account';
    return SETTINGS[s] ? page(SETTINGS_NAME[s], SETTINGS[s], 'Settings') : page('Settings', SETTINGS.account);
  }
  /* a setup's own page: /compass/NVDA-480-C-weekly-… — the name is the address's first part */
  if (path.startsWith('/compass/')) {
    const name = decodeURIComponent(path.split('/')[2] ?? '').split('-')[0].toUpperCase();
    return page(name ? `${name} setup` : 'Setup', 'One setup on its own page: why it was chosen, the levels it leans on, and its live state.', 'Compass');
  }
  for (const sec of SECTIONS) {
    if (path !== sec.base && !path.startsWith(`${sec.base}/`)) continue;
    const exact = sec.pages.find(p => p.path === path);
    if (exact) return page(exact.label, sentence(exact.subtitle), sec.name);
    /* a page under one of the section's pages: a NAME's own (/record/stocks/NVDA — the segment is the name), or a thing
       with an id (/practice/backtest/smuaf0fpb3x, /practice/journal/<account>/<trade>) that says its own words, or none */
    const parent = sec.pages.find(p => path.startsWith(`${p.path}/`));
    if (parent) {
      if (own) return page(own, sentence(parent.subtitle), parent.label);
      const seg = decodeURIComponent(path.slice(parent.path.length + 1).split('/')[0]);
      if (!TICKER.test(seg)) return page(parent.label, sentence(parent.subtitle), sec.name);
      const name = seg.toUpperCase();
      const about = NAME_PAGE[parent.path]?.(name) ?? sentence(parent.subtitle);
      return page(`${name} · ${parent.label}`, about, sec.name);
    }
    return page(sec.name, sentence(sec.pages[0].subtitle));
  }
  return { title: SITE, description: LANDING.description };
}

const setMeta = (selector: string, content: string) => {
  document.head.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', content);
};

const PageMeta = () => {
  const { pathname } = useLocation();
  const own = useSaid();
  useEffect(() => {
    const m = metaFor(pathname, own);
    document.title = m.title;
    setMeta('meta[name="description"]', m.description);
    setMeta('meta[property="og:title"]', m.title);
    setMeta('meta[property="og:description"]', m.description);
    setMeta('meta[name="twitter:title"]', m.title);
    setMeta('meta[name="twitter:description"]', m.description);
  }, [pathname, own]);
  return null;
};

export default PageMeta;
