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
   lime that means live, the silver that means where you are, the magenta of
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
    description: 'The live market desk — chart, dealer pressure & key levels, arranged your way',
    group: 'Home',
  },
  // ── Market ──
  {
    path: '/terrain',
    label: 'Terrain',
    code: '02',
    icon: CandlestickChart,
    ink: NAV_INK.terrain,
    description: 'Charts only — one to four books side by side, one set of controls',
    group: 'Market',
  },
  {
    path: '/trace',
    label: 'Trace',
    code: '03',
    icon: Radar,
    ink: NAV_INK.trace,
    description: 'Options flow & dark-pool intelligence — what the prints actually mean',
    group: 'Market',
  },
  {
    path: '/dossier',
    label: 'Dossier',
    code: '04',
    icon: ScrollText,
    ink: NAV_INK.record,
    description: 'The file on a name — its news, its earnings, what insiders filed, what Congress disclosed, how it screens',
    group: 'Market',
  },
  // ── The book ──
  {
    path: '/pinpoint',
    label: 'Pinpoint',
    code: '05',
    icon: Crosshair,
    ink: NAV_INK.pinpoint,
    description: 'GEX & dealer-positioning system',
    group: 'The book',
  },
  // ── Trade ──
  {
    path: '/compass',
    label: 'Compass',
    code: '06',
    icon: Compass,
    ink: NAV_INK.compass,
    /* "weighed and graded" until 2026-09-19 — the rail's tooltip and the palette's hint read this, and we do not say we grade */
    description: 'Contracts that fit the levels right now — weeklies, swings and LEAPS, the strongest first',
    group: 'Trade',
  },
  {
    path: '/weigher',
    label: 'Weigher',
    code: '07',
    icon: Scale,
    ink: NAV_INK.weigher,
    description: 'Chart, chain and watchlist on one desk — pick a contract, watch it, and the record follows',
    group: 'Trade',
  },
  // ── Practice ──
  {
    path: '/practice/paper',
    label: 'Paper',
    code: '08',
    icon: LineChart,
    ink: NAV_INK.paperDesk,
    description: 'Trade today’s prices with pretend money — a practice account or a prop firm’s evaluation, in options: calls, puts and spreads',
    group: 'Practice',
  },
  {
    path: '/practice/backtest',
    label: 'Backtest',
    code: '09',
    icon: History,
    ink: NAV_INK.backtest,
    description: 'Replay a past market and trade its option contracts with pretend money — test an edge',
    group: 'Practice',
  },
  {
    path: '/practice/journal',
    label: 'Journal',
    code: '10',
    icon: NotebookPen,
    ink: NAV_INK.journal,
    description: 'Every trade you closed — paper or backtest — on its day, with your own words on it',
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
  Practice: { icon: Dumbbell, hint: 'Trade with pretend money — today’s prices or a past market — and look back', caption: 'Practice' },
  More: { icon: Settings, hint: 'The room, and how the terminal is set', caption: null },
};

export const itemsByGroup = (group: NavGroup): NavItem[] =>
  NAV_ITEMS.filter(i => i.group === group);
