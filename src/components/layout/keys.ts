/*
==================================================
  SLAYER TERMINAL - EVERY KEY, AND THE MACHINE'S OWN MODIFIER
  (components/layout/keys.ts)

  ONE LIST OF THE KEYS (2026-10-09): Settings ›
  Keyboard prints it whole, and the sheet that `?`
  opens over any page prints the groups that work on
  the page you are on (ShortcutSheet.tsx) — so the
  two can never disagree. A group's `where` names
  the pages it works on; "Everywhere" is on every
  sheet.

  THE MACHINE'S OWN KEY (the audit's SH-11): the rail
  printed ⌘K, Settings and the 404 printed Ctrl K, and
  the owner is on Windows. A Mac reads ⌘, every other
  machine Ctrl — `MOD` is the word, `modKey('K')` the
  printed chord ("⌘K" or "Ctrl K").
==================================================
*/

/** A Mac (or an iPad with a keyboard) — its modifier is ⌘ */
export const IS_MAC: boolean = (() => {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const p = nav.userAgentData?.platform ?? nav.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(p) || /Mac OS X/.test(nav.userAgent ?? '');
})();

/** The modifier's printed name: "⌘" on a Mac, "Ctrl" elsewhere */
export const MOD = IS_MAC ? '⌘' : 'Ctrl';

/** A chord with the modifier, as the machine says it: "⌘K", "Ctrl K" */
export const modKey = (key: string): string => (IS_MAC ? `⌘${key}` : `Ctrl ${key}`);

/** The palette's own chord — the rail, the tips, the sheet and the 404 print this */
export const PALETTE_KEY = modKey('K');

export type Shortcut = { keys: string[]; does: string; alt?: boolean };
export interface KeyGroup {
  where: string;
  /** The pages it works on — an address that starts with any of these; none means everywhere */
  on?: string[];
  keys: Shortcut[];
}

/* EVERY KEY THE TERMINAL ANSWERS TO, grouped by where it works (Noah, 2026-09-13, on the page listing six: "do you think
   it's too short?" — it was under-listed, not too short: Terrain's desk answers to twelve more). Each group's keys are read
   off the handler that owns them — AppShell (the palette, the sheet, the search key), CommandPalette (its list), Terrain's
   pane keys, ResetViewControl (Alt+R while the pointer is over a chart), the script editor's keymap (Mod-s, Mod-Enter).
   `alt` marks keys that are alternatives ("1 / 2 / 3 / 4") rather than a chord ("Ctrl + K"). */
export const KEY_GROUPS: KeyGroup[] = [
  {
    where: 'Everywhere',
    keys: [
      { keys: [MOD, 'K'], does: 'The command line — a name, a page, a name and a page ("NVDA flow"), or an action' },
      { keys: ['↑', '↓'], alt: true, does: "Walk the command line's results" },
      { keys: ['Enter'], does: 'Open the result under the mark' },
      { keys: ['/'], does: "The page's own search, or the command line where a page has none" },
      { keys: ['?'], does: 'The keys for the page you are on' },
      { keys: [MOD, 'Z'], does: 'Undo what was just removed, while its chip is up' },
      { keys: ['Esc'], does: 'Close what is open — a menu, the alerts, the ladder (from inside it), fullscreen, a replay' },
    ],
  },
  {
    where: 'Terrain · the desk',
    on: ['/terrain'],
    keys: [
      { keys: ['1', '2', '3', '4'], alt: true, does: 'How many charts — one to four' },
      { keys: ['[', ']'], alt: true, does: 'Walk the charts — the one before, the one after' },
      { keys: ['Shift', 'R'], does: 'The strike rail beside every chart — on or off' },
    ],
  },
  {
    where: 'Terrain · the active chart',
    on: ['/terrain'],
    keys: [
      { keys: ['F'], does: 'Expand it to the full screen, and back' },
      { keys: ['S'], does: 'Pick its symbol' },
      { keys: ['C'], does: 'Compare — cross another name onto it' },
      { keys: ['↑', '↓'], alt: true, does: 'Flip its name through the watchlist' },
      { keys: ['−', '='], alt: true, does: 'Step its timeframe down, up' },
      { keys: ['P'], does: 'Replay — pick a bar, then play' },
      { keys: ['D'], does: 'Draw mode — the tools in hand' },
      { keys: ['R'], does: 'Its strike rail — on or off' },
    ],
  },
  {
    where: 'Practice · the backtest desk',
    on: ['/practice/backtest/'],
    keys: [
      { keys: ['Space'], does: 'Play the clock, and pause it' },
      { keys: ['←', '→'], alt: true, does: 'Step a minute back, a minute on — never back past your last order' },
      { keys: ['Shift', '→'], does: 'Five minutes on (Shift ← for five back)' },
      { keys: ['End'], does: 'Run to the bell' },
      { keys: ['N'], does: 'Ring the bell and open the next day' },
      { keys: ['F'], does: 'The chart to the full screen, and back' },
      { keys: ['D'], does: 'Draw mode on the chart in hand' },
      { keys: ['T'], does: 'To the order — its size, ready to type' },
      { keys: ['1', '2'], alt: true, does: 'Put the first name on the desk, or the second' },
      { keys: ['\\'], does: 'In the full screen: fold the chain away, and back' },
    ],
  },
  {
    where: 'Practice · a trade in the journal',
    on: ['/practice/journal/'],
    keys: [
      { keys: ['←', '→'], alt: true, does: 'The trade closed after this one, or the one before — the journal’s own order' },
      { keys: ['Esc'], does: 'Back to the journal, as you left it' },
    ],
  },
  {
    where: 'Charts · anywhere a chart is up',
    on: ['/pulse', '/terrain', '/weigher', '/pinpoint/map', '/practice/paper', '/practice/backtest/', '/trace/net-flow', '/trace/odte', '/compass/'],
    keys: [{ keys: ['Alt', 'R'], does: 'Reset the view of the chart under the pointer' }],
  },
  {
    where: 'The script editor',
    on: ['/terrain', '/pulse', '/weigher', '/pinpoint/map'],
    keys: [
      { keys: [MOD, 'S'], does: 'Save the script' },
      { keys: [MOD, 'Enter'], does: 'Run it on its chart' },
    ],
  },
];

/** The groups that work on this address: Everywhere first, then the page's own */
export const keyGroupsFor = (pathname: string): KeyGroup[] =>
  KEY_GROUPS.filter(g => !g.on || g.on.some(p => (p.endsWith('/') ? pathname.startsWith(p) && pathname.length > p.length : pathname === p || pathname.startsWith(`${p}/`))));
