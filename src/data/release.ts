/*
==================================================
  SLAYER TERMINAL - WHAT SHIPPED (data/release.ts)

  The changelog the status page lists and the "What's new" card shows, and the version the signature prints
  ("slayer:~ $ ● live · v2026.10"). Every line is a real change from this repository's history, said the brand's way: a
  plain sentence, what it does for you (Slayer Logo System, 09 · Voice). Newest first; add a line when something ships.
  A line's `path` is where to see it: inside the terminal, or on the front page.
==================================================
*/

export interface Release {
  /** vYYYY.MM.DD — the day it shipped */
  version: string;
  /** the product it belongs to, when it belongs to one */
  product?: string;
  line: string;
  /** where to see it */
  path?: string;
}

export const CHANGELOG: Release[] = [
  { version: 'v2026.10.09', line: 'Plans can be paid for a year at a time, two months free.', path: '/#pricing' },
  { version: 'v2026.10.09', line: 'Sign-in and sign-up show the password on request, and say what each field needs before you send it.', path: '/signup' },
  { version: 'v2026.10.08', line: 'The front page shows every room on one wall, in depth.', path: '/#rooms' },
  { version: 'v2026.10.07', line: 'The front page fits every screen, from a phone to an ultrawide, as one piece.', path: '/' },
  { version: 'v2026.10.05', line: 'A new front page: one session on SPY read off the terminal as it ran, then every room in turn.', path: '/#how' },
  { version: 'v2026.10.05', line: 'The holographic silver is stronger, on black and on paper.', path: '/' },
  { version: 'v2026.10.01', line: 'The mark lives: it says when the market is closed, when a page is loading and when an alert fires. Every product has its own glyph.', path: '/pulse' },
  { version: 'v2026.09.30', product: 'Paper', line: 'Paper trades options only: calls, puts and spreads off the chain, with paper money.', path: '/practice/paper' },
  { version: 'v2026.09.30', line: 'Every page reads in light and in dark, guides and menus included.', path: '/settings/appearance' },
  { version: 'v2026.09.30', product: 'Journal', line: 'The Journal opens without the second-long freeze.', path: '/practice/journal' },
  { version: 'v2026.09.21', product: 'Alerts', line: 'Set an alert from the drawer, not only from the panel that shows the level.', path: '/alerts' },
  { version: 'v2026.09.21', product: 'Trace', line: 'The tape prints each trade as one line you can read, with the evidence beside it.', path: '/trace/live-tape' },
  { version: 'v2026.09.21', product: 'Weigher', line: 'The chain shows the IV beside the price it came from.', path: '/weigher' },
  { version: 'v2026.09.20', product: 'Paper', line: 'The ladder is rebuilt as a depth of market, from the data we have.', path: '/practice/paper' },
  { version: 'v2026.09.19', product: 'Paper', line: 'The chart is the order ticket: brackets you can grab and drag.', path: '/practice/paper' },
];

/** vYYYY.MM — the month of the newest release */
export const VERSION = CHANGELOG[0].version.slice(0, 8);

/** The newest change — the "What's new" card (it read the newest that belonged to a product, a week behind the list —
    the audit's OU-S3) */
export const WHATS_NEW: Release = CHANGELOG[0];
