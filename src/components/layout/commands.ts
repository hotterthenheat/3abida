/*
==================================================
  SLAYER TERMINAL - THE COMMAND LINE'S WORDS (components/layout/commands.ts)

  Every page the terminal has, as the command line
  (⌘K / Ctrl K, CommandPalette.tsx) knows it: its
  name, a short CODE of its own, and the plain
  words a trader types for it. Bloomberg's grammar,
  in the house's words (2026-10-09, the ideas'
  first pick): a name and a function opens that
  page on that name — "NVDA flow", "SPY walls",
  "AAPL chain", "QQQ earnings" — and a page's code
  ("NF", "MAP") opens it on its own.

  A page that is built round one name opens on that
  name's own address (a Dossier stock or earnings
  page); every other page opens on the terminal's
  subject, which the command makes the name first.
==================================================
*/

import { GEX_SUBPAGES } from '../../pages/pinpoint/subnav';
import { TRACE_SUBPAGES } from '../../pages/trace/subnav';
import { RECORD_SUBPAGES } from '../../pages/record/subnav';
import { NAV_ITEMS } from './nav';
import type { GlyphName } from '../../brand/paths';

export interface PageCommand {
  id: string;
  /** "Trace → Net Flow" */
  label: string;
  /** Its own short code, printed beside it and typed on its own */
  code: string;
  path: string;
  /** The address on a NAME, for a page built round one; else the page itself, on the subject */
  pathFor?: (ticker: string) => string;
  /** What a trader types for it after a name — "flow", "walls", "chain" */
  words: string[];
  hint: string;
  /** The product it belongs to — its glyph in the list */
  glyph?: GlyphName;
}

const glyphOf = (path: string): GlyphName | undefined => NAV_ITEMS.find(i => path === i.path || path.startsWith(`${i.path}/`))?.glyph;

/* THE CODES AND THE WORDS — one row per page. A word may name one page only; the first page that claims it keeps it. */
const CODES: Record<string, { code: string; words: string[]; pathFor?: (t: string) => string }> = {
  '/pulse': { code: 'PU', words: ['pulse', 'desk', 'home'] },
  '/pulse/board': { code: '4UP', words: ['four charts', 'four', 'quad', '4 charts'] },
  '/terrain': { code: 'TE', words: ['chart', 'terrain', 'candles', 'gp'] },
  '/trace/live-tape': { code: 'LT', words: ['tape', 'prints', 'time and sales', 'tas'] },
  '/trace/screener': { code: 'SCR', words: ['screener', 'screen', 'unusual'] },
  '/trace/net-flow': { code: 'NF', words: ['flow', 'netflow', 'net flow', 'premium'] },
  '/trace/footprints': { code: 'FP', words: ['footprints', 'footprint'] },
  '/trace/watchers': { code: 'WAT', words: ['watchers', 'catches'] },
  '/trace/windows': { code: 'WIN', words: ['windows', 'quarters'] },
  '/trace/odte': { code: '0D', words: ['0dte', 'zero dte', 'same day', 'odte'] },
  '/trace/multi-leg': { code: 'ML', words: ['multi-leg', 'multileg', 'spreads', 'legs', 'structures'] },
  '/trace/dark-pool': { code: 'DP', words: ['dark pool', 'darkpool', 'dark', 'blocks'] },
  '/trace/compare': { code: 'TCMP', words: ['flow compare', 'compare flow'] },
  '/trace/tracker': { code: 'BKM', words: ['bookmarks', 'bookmarked'] },
  '/dossier/news': { code: 'NW', words: ['news', 'headlines', 'wire', 'cn'] },
  '/dossier/earnings': { code: 'ERN', words: ['earnings', 'ern', 'eps', 'report'], pathFor: t => `/dossier/earnings/${t}` },
  '/dossier/insiders': { code: 'INS', words: ['insiders', 'insider', 'form 4'] },
  '/dossier/congress': { code: 'CONG', words: ['congress', 'politicians', 'stock act'] },
  '/dossier/stocks': { code: 'DES', words: ['stock', 'dossier', 'file', 'overview', 'des', 'fundamentals'], pathFor: t => `/dossier/stocks/${t}` },
  '/pinpoint/map': { code: 'MAP', words: ['walls', 'levels', 'lvl', 'gex', 'map', 'gamma', 'ladder'] },
  '/pinpoint/ahead': { code: 'AHD', words: ['ahead', 'range', 'close', 'where it closes'] },
  '/pinpoint/building': { code: 'BLD', words: ['building', 'build', 'drift'] },
  '/pinpoint/wall': { code: 'WALL', words: ['wall', 'at the wall', 'hold'] },
  '/pinpoint/targets': { code: 'TGT', words: ['targets', 'target', 'agenda'] },
  '/pinpoint/board': { code: 'BRD', words: ['board', 'every name'] },
  '/pinpoint/compare': { code: 'CMP', words: ['compare', 'vs', 'versus'] },
  '/compass': { code: 'CO', words: ['compass', 'setups', 'contracts', 'ideas'] },
  '/compass/tracker': { code: 'CTRK', words: ['tracker', 'tracked', 'my setups'] },
  '/weigher': { code: 'WE', words: ['chain', 'options', 'weigher', 'omon', 'watchlist', 'positions'] },
  '/practice/paper': { code: 'PAP', words: ['paper', 'trade', 'practice'] },
  '/practice/backtest': { code: 'BT', words: ['backtest', 'replay', 'review'] },
  '/practice/journal': { code: 'JRN', words: ['journal', 'trades', 'log'] },
  '/settings': { code: 'SET', words: ['settings', 'preferences', 'prefs'] },
  '/glossary': { code: 'GLOS', words: ['glossary', 'words', 'terms', 'definitions', 'dictionary', 'meaning'] },
};

const make = (path: string, label: string, hint: string): PageCommand => {
  const c = CODES[path] ?? { code: '', words: [] };
  return { id: `page:${path}`, label, code: c.code, path, pathFor: c.pathFor, words: c.words, hint, glyph: glyphOf(path) };
};

/** Every page, in the rail's order — the products, then the pages under each */
export const PAGE_COMMANDS: PageCommand[] = [
  ...NAV_ITEMS.filter(i => i.path !== '/settings').flatMap(item => {
    const own = make(item.path, item.group === 'Practice' ? `Practice → ${item.label}` : item.label, item.description);
    if (item.path === '/pulse') return [own, make('/pulse/board', 'Pulse → Four charts', 'Four names at once, each with its own timeframe and overlays')];
    if (item.path === '/pinpoint') return GEX_SUBPAGES.map(p => make(p.path, `Pinpoint → ${p.label}`, p.subtitle));
    if (item.path === '/trace') return TRACE_SUBPAGES.map(p => make(p.path, `Trace → ${p.label}`, p.subtitle));
    if (item.path === '/dossier') return RECORD_SUBPAGES.map(p => make(p.path, `Dossier → ${p.label}`, p.subtitle));
    if (item.path === '/compass') return [make('/compass', 'Compass → The board', item.description), make('/compass/tracker', 'Compass → Tracker', 'The setups you keep, live')];
    return [own];
  }),
  /* THE GLOSSARY (2026-10-10): not a room, a page every room's words lead to */
  make('/glossary', 'Glossary', 'Every word the terminal uses — what it means, and what it stands on'),
];

/* EVERY SETTINGS SECTION (the audit's SH-5: "appearance" and "keyboard" found nothing) */
export const SETTINGS_COMMANDS: { id: string; label: string; code: string; path: string; words: string[]; hint: string }[] = [
  { id: 'account', label: 'Account', code: 'ACCT', words: ['account', 'profile', 'name', 'email', 'sign out'], hint: 'Your picture, name, handle and where you sign in' },
  { id: 'billing', label: 'Billing', code: 'BILL', words: ['billing', 'plan', 'invoices', 'card', 'payment', 'receipt'], hint: 'Your plan, the card, the receipts' },
  { id: 'data', label: 'Data', code: 'DATA', words: ['data', 'export', 'import', 'clear', 'storage'], hint: 'What is kept on this machine — export, import, clear' },
  { id: 'appearance', label: 'Appearance', code: 'LOOK', words: ['appearance', 'theme', 'dark', 'light', 'candles', 'colour', 'color', 'colour vision', 'colorblind'], hint: 'Theme, candles, the direction colours' },
  { id: 'desk', label: 'The desk', code: 'DESK', words: ['desk', 'ruler', 'clock', 'opens on', 'timeframe', 'session strip', 'notifications'], hint: 'The ruler, what a desk opens on, the clock, the session strip' },
  { id: 'sounds', label: 'Sounds', code: 'SND', words: ['sounds', 'sound', 'chime', 'speak', 'spoken', 'voice'], hint: 'The four tones, and alerts said aloud' },
  { id: 'invite', label: 'Invite a trader', code: 'INV', words: ['invite', 'referral'], hint: 'Your link' },
  { id: 'mail', label: 'Email preferences', code: 'MAIL', words: ['mail', 'email preferences', 'unsubscribe', 'newsletter'], hint: 'Which mail comes' },
  { id: 'keyboard', label: 'Keyboard', code: 'KEYS', words: ['keyboard', 'keys', 'shortcuts', 'hotkeys'], hint: 'Every key the terminal answers to' },
  { id: 'about', label: 'About', code: 'ABOUT', words: ['about', 'version', 'licences', 'licenses'], hint: 'The version and the licences' },
].map(s => ({ ...s, id: `settings:${s.id}`, path: `/settings/${s.id}`, label: `Settings → ${s.label}` }));

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** The page a function word or a code names — "flow", "nf", "walls", "dark pool" — or null */
export function pageForWord(word: string): PageCommand | null {
  const w = norm(word);
  if (!w) return null;
  return (
    PAGE_COMMANDS.find(p => p.code.toLowerCase() === w) ??
    PAGE_COMMANDS.find(p => p.words.includes(w)) ??
    PAGE_COMMANDS.find(p => p.words.some(x => x.startsWith(w) && w.length >= 3)) ??
    null
  );
}

/** The page whose code is exactly this — a code typed alone jumps to the top */
export const pageForCode = (code: string): PageCommand | null => {
  const c = norm(code);
  return PAGE_COMMANDS.find(p => p.code.toLowerCase() === c) ?? SETTINGS_COMMANDS.find(s => s.code.toLowerCase() === c) as PageCommand | undefined ?? null;
};

/** How a page is opened on a name: its own address for the name, else the page itself */
export const pathOn = (p: PageCommand, ticker: string): string => (p.pathFor ? p.pathFor(ticker) : p.path);
