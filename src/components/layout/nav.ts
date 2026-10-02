import {
  Activity,
  Crosshair,
  Compass,
  Radar,
  Scale,
  ScrollText,
  CandlestickChart,
  Settings,
  History,
  LineChart,
  NotebookPen,
  Dumbbell,
  type LucideIcon,
} from 'lucide-react';
import type { GlyphName } from '../../brand/paths';

/* THE RAIL, BY THE QUESTION A TRADER IS ASKING, IN THE ORDER THEY ASK IT (Noah, 2026-09-28: "the manage section should be
   at the very bottom … if pulse is the first page a user is going to see then that should be at the very top … we need
   to really fix the analyze, discover, and record sections and what belongs where"). The old captions said what you DO
   (discover, analyze, manage) and the pages under them did not share a job. Now:

     HOME       Pulse — the desk you land on — and Alerts under it, no caption
     MARKET     what is happening and what happened: Terrain (the chart), Trace (the tape), Dossier (news, earnings,
                insiders, Congress, stocks)
     THE BOOK   Pinpoint — where dealer hedging pushes; the product's centre, under the house's own word for it
     TRADE      the two pages that end in a contract: Compass (what to trade), Weigher (which contract, the watchlist,
                your positions)
     PRACTICE   Paper · Backtest · Journal — his name, his order
     MORE       Community · Settings at the very bottom, no caption — doors, not work

   No address moved. */
export type NavGroup = 'Home' | 'Market' | 'The book' | 'Trade' | 'Practice' | 'More';

/* EACH DESK'S OWN INK (the lock walk, Noah, 2026-09-09: "i think these icons
   can benefit from color"): a muted categorical hue per item, the News page's
   and the sector dots' kind — identity, not meaning — so none of them is the
   silver that means live and where you are, the magenta of
   the supreme or the red and green of direction. Neighbours in a group sit
   apart on the wheel. */
export const NAV_INK = {
  alerts: '#E9A23B',
  compass: '#4FB8B8',
  weigher: '#A78BFA',
  trace: '#F0925A',
  pulse: '#E86F8A',
  terrain: '#86B98B',
  pinpoint: '#7CC4E8',
  record: '#8EA2F5',
  tracker: '#5DBFA0',
  community: '#D98BB5',
  settings: '#C2B280',
  backtest: '#D4A5FF',
  journal: '#E6B566',
  /* PAPER (2026-09-22): the Live Chart, apart on the wheel from its neighbours above */
  paperDesk: '#62B6CB',
} as const;

export interface NavItem {
  path: string;
  label: string;
  code: string;
  icon: LucideIcon;
  /** The product's glyph (Slayer Logo System, 04 · Product icons) — the rail, the menus and the palette draw it
      (brand/ProductGlyph.tsx); `icon` stays for the places that draw a line icon. Settings has none: it is a door, not a
      product, and keeps its line icon. */
  glyph?: GlyphName;
  /** The desk's own ink — its icon wears it (NAV_INK) */
  ink: string;
  description: string;
  group: NavGroup;
}

export const NAV_ITEMS: NavItem[] = [
  // ── Home ──
  {
    path: '/pulse',
    label: 'Pulse',
    code: '01',
    icon: Activity,
    ink: NAV_INK.pulse,
    glyph: 'pulse',
    description: 'The live desk: chart, dealer pressure and key levels, arranged your way',
    group: 'Home',
  },
  // ── Market ──
  {
    path: '/terrain',
    label: 'Terrain',
    code: '02',
    icon: CandlestickChart,
    ink: NAV_INK.terrain,
    glyph: 'terrain',
    description: 'Charts only: up to four side by side, your Pine scripts, your drawings',
    group: 'Market',
  },
  {
    path: '/trace',
    label: 'Trace',
    code: '03',
    icon: Radar,
    ink: NAV_INK.trace,
    glyph: 'trace',
    description: 'The live tape and what it means: dark pool, net flow, footprints, 0DTE, multi-leg',
    group: 'Market',
  },
  {
    path: '/dossier',
    label: 'Dossier',
    code: '04',
    icon: ScrollText,
    ink: NAV_INK.record,
    glyph: 'dossier',
    description: 'The file on a ticker: news, earnings, insiders, Congress trades, how it screens',
    group: 'Market',
  },
  // ── The book ──
  {
    path: '/pinpoint',
    label: 'Pinpoint',
    code: '05',
    icon: Crosshair,
    ink: NAV_INK.pinpoint,
    glyph: 'pinpoint',
    description: 'Where dealer hedging holds and pushes price: walls, the flip, the range into the close',
    group: 'The book',
  },
  // ── Trade ──
  {
    path: '/compass',
    label: 'Compass',
    code: '06',
    icon: Compass,
    ink: NAV_INK.compass,
    glyph: 'compass',
    /* "weighed and graded" until 2026-09-19 — the rail's tooltip and the palette's hint read this, and we do not say we grade.
       Every line here is the Logo System's own (06 · Menu and rail, 2026-09-30): one line per product. */
    description: 'Contracts that fit the levels right now, weeklies to LEAPS, plus the Tracker',
    group: 'Trade',
  },
  {
    path: '/weigher',
    label: 'Weigher',
    code: '07',
    icon: Scale,
    ink: NAV_INK.weigher,
    glyph: 'weigher',
    description: 'Chain, watchlist and positions on one desk, and what each returns at every price',
    group: 'Trade',
  },
  // ── Practice ──
  {
    path: '/practice/paper',
    label: 'Paper',
    code: '08',
    icon: LineChart,
    ink: NAV_INK.paperDesk,
    glyph: 'paper',
    description: 'Today’s prices with paper money, or a prop firm’s evaluation',
    group: 'Practice',
  },
  {
    path: '/practice/backtest',
    label: 'Backtest',
    code: '09',
    icon: History,
    ink: NAV_INK.backtest,
    glyph: 'backtest',
    description: 'Replay a past market minute by minute and trade it',
    group: 'Practice',
  },
  {
    path: '/practice/journal',
    label: 'Journal',
    code: '10',
    icon: NotebookPen,
    ink: NAV_INK.journal,
    glyph: 'journal',
    description: 'Every closed trade on its chart, with your tags and your words',
    group: 'Practice',
  },
  // ── More ── (Community is off the menu until it opens, 2026-09-30; its page stays at /community)
  {
    path: '/settings',
    label: 'Settings',
    code: '11',
    icon: Settings,
    ink: NAV_INK.settings,
    description: 'How the terminal looks, what the desk opens on, what it says out loud',
    group: 'More',
  },
];

export const NAV_GROUPS: NavGroup[] = ['Home', 'Market', 'The book', 'Trade', 'Practice', 'More'];

/** Each group's face: an icon, a one-line answer to "what is this group for", and its caption on the rail — null
    for the two that stand without one (Home at the top, More at the bottom) */
export const NAV_GROUP_META: Record<NavGroup, { icon: LucideIcon; hint: string; caption: string | null }> = {
  Home: { icon: Activity, hint: 'The desk you land on', caption: null },
  Market: { icon: CandlestickChart, hint: 'What the market is doing, and what happened', caption: 'Market' },
  'The book': { icon: Crosshair, hint: 'Where dealer hedging pushes', caption: 'The book' },
  Trade: { icon: Compass, hint: 'What to trade, and which contract', caption: 'Trade' },
  Practice: { icon: Dumbbell, hint: 'Trade with paper money, replay the past, review every trade', caption: 'Practice' },
  More: { icon: Settings, hint: 'The room, and how the terminal is set', caption: null },
};

export const itemsByGroup = (group: NavGroup): NavItem[] =>
  NAV_ITEMS.filter(i => i.group === group);
