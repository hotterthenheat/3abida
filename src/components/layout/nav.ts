import {
  Activity,
  Crosshair,
  Compass,
  Radar,
  Scale,
  Sigma,
  ScrollText,
  Bookmark,
  ClipboardPen,
  MessageSquareWarning,
  Users,
  Telescope,
  CandlestickChart,
  Microscope,
  FolderKanban,
  ClipboardCheck,
  Settings,
  type LucideIcon,
} from 'lucide-react';

// Navigation is organised by WORKFLOW, not by product name: Discover → Analyze
// → Manage → Review reads as the pipeline a trader actually runs, so a new
// user knows what each tab is FOR before learning a single brand name. The
// branded desks (Pulse, Compass, Pinpoint…) live inside those workflows.
// Home exits via the wordmark.
export type NavGroup = 'Discover' | 'Analyze' | 'Manage' | 'Review';

/* EACH DESK'S OWN INK (the lock walk, Noah, 2026-09-09: "i think these icons
   can benefit from color"): a muted categorical hue per item, the News page's
   and the sector dots' kind — identity, not meaning — so none of them is the
   lime that means live, the silver that means where you are, the magenta of
   the supreme or the red and green of direction. Neighbours in a group sit
   apart on the wheel. */
export const NAV_INK = {
  alerts: '#E9A23B',
  compass: '#4FB8B8',
  watchlist: '#C48BD9',
  weigher: '#A78BFA',
  /* the paper desk's straw — between the Weigher's violet and Trace's orange
     on the wheel, and nothing the terminal means by a colour (2026-09-19) */
  paper: '#E2C15E',
  trace: '#F0925A',
  pulse: '#E86F8A',
  terrain: '#86B98B',
  pinpoint: '#7CC4E8',
  record: '#8EA2F5',
  tracker: '#5DBFA0',
  community: '#D98BB5',
  settings: '#C2B280',
  proveIt: '#9AA5B8',
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
  // ── Discover — find what is moving and what to trade ──
  {
    path: '/compass',
    label: 'Compass',
    code: '01',
    icon: Compass,
    ink: NAV_INK.compass,
    description: 'Options chooser — weeklies, swings & LEAPS weighed and graded',
    group: 'Discover',
  },
  {
    path: '/weigher',
    label: 'Weigher',
    code: '02',
    icon: Scale,
    ink: NAV_INK.weigher,
    description: 'The weigh station — chart, chain and scanner on one desk, with what a contract has to clear',
    group: 'Discover',
  },
  /* THE PAPER DESK (Noah, 2026-09-19: "put this paper trader in a tab below
     weigher") — the chart as the order ticket: futures and options traded on
     paper against the terminal's market state, one engine behind every hand */
  {
    path: '/paper',
    label: 'Paper',
    code: '03',
    icon: ClipboardPen,
    ink: NAV_INK.paper,
    description: 'Paper trading — trade futures and options on the chart itself, against the live tape, no real money',
    group: 'Discover',
  },
  /* Stocks moved under the Record (2026-09-10) — the screens are a record about a name, read beside its news and filings */
  /* THE NAMES YOU CARRY (2026-09-21) — first in Discover, because a session
     starts by deciding what to look at */
  {
    path: '/watchlist',
    label: 'Watchlists',
    code: '04',
    icon: Bookmark,
    ink: NAV_INK.watchlist,
    description: 'The names you are carrying — price, flip, walls and field, one row each',
    group: 'Discover',
  },
  {
    path: '/trace',
    label: 'Trace',
    code: '04',
    icon: Radar,
    ink: NAV_INK.trace,
    description: 'Options flow & dark-pool intelligence — what the prints actually mean',
    group: 'Discover',
  },
  // ── Analyze — study the tape, the dealers, the catalysts ──
  {
    path: '/pulse',
    label: 'Pulse',
    code: '05',
    icon: Activity,
    ink: NAV_INK.pulse,
    description: 'The live market desk — chart, dealer pressure & key levels, arranged your way',
    group: 'Analyze',
  },
  {
    path: '/terrain',
    label: 'Terrain',
    code: '06',
    icon: CandlestickChart,
    ink: NAV_INK.terrain,
    description: 'Charts only — one to four books side by side, one set of controls',
    group: 'Analyze',
  },
  {
    path: '/pinpoint',
    label: 'Pinpoint',
    code: '07',
    icon: Crosshair,
    ink: NAV_INK.pinpoint,
    description: 'GEX & dealer-positioning system',
    group: 'Analyze',
  },
  /* THE RECORD (2026-09-09): News and Earnings moved under one head with the two
     pages the partner built — Insiders (SEC Form 4) and Congress (STOCK Act) */
  {
    path: '/record',
    label: 'Record',
    code: '08',
    icon: ScrollText,
    ink: NAV_INK.record,
    description: 'What is on the record about a name — news, earnings, insiders, Congress',
    group: 'Analyze',
  },
  // ── Manage — track what you are in, build your desk, talk shop ──
  {
    path: '/community',
    label: 'Community',
    code: '10',
    icon: Users,
    ink: NAV_INK.community,
    description: 'The room — traders, setups and the record they build',
    group: 'Manage',
  },
  /* FEEDBACK AND BUGS, its own page (Noah, 2026-09-13) — suggestions and bug
     reports with their votes, out of the community room */
  {
    path: '/feedback',
    label: 'Feedback',
    code: '09',
    icon: MessageSquareWarning,
    ink: NAV_INK.tracker,
    description: 'Suggest what to build, report what broke — every note is read',
    group: 'Manage',
  },
  /* THE SETTINGS (2026-09-12): how the terminal looks, what the desk opens
     on, what it says out loud — the theme first */
  {
    path: '/settings',
    label: 'Settings',
    code: '11',
    icon: Settings,
    ink: NAV_INK.settings,
    description: 'How the terminal looks, what the desk opens on, what it says out loud',
    group: 'Manage',
  },
  // ── Review — audit the models and the calls ──
  {
    path: '/prove-it',
    label: 'Prove It',
    code: '12',
    icon: Sigma,
    ink: NAV_INK.proveIt,
    description: 'Quantitative modeling & predictive analytics',
    group: 'Review',
  },
];

export const NAV_GROUPS: NavGroup[] = ['Discover', 'Analyze', 'Manage', 'Review'];

/** Top-bar tab metadata: the icon Noah asked for + a one-line answer to
    "what is this tab for", shown as the dropdown header. */
export const NAV_GROUP_META: Record<NavGroup, { icon: LucideIcon; hint: string }> = {
  Discover: { icon: Telescope, hint: 'Find what to trade' },
  Analyze: { icon: Microscope, hint: 'Study the tape & the dealers' },
  Manage: { icon: FolderKanban, hint: 'Track what you are in' },
  Review: { icon: ClipboardCheck, hint: 'Audit the models' },
};

export const itemsByGroup = (group: NavGroup): NavItem[] =>
  NAV_ITEMS.filter(i => i.group === group);
