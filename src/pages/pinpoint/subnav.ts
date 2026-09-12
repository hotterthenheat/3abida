import { BrickWall, Hammer, Hourglass, LayoutGrid, Map, Scale, Target, type LucideIcon } from 'lucide-react';

/** Pinpoint subpage registry — drives the sub-tab bar and command palette. */
export interface GexSubpage {
  path: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
}

/*
  THE BLANK CANVAS (Noah, 2026-09-05): "im thinking about starting the entire
  pinpoint page from scratch… the only decent things we have right now that i
  like is the ranked targets page, and the strike pressure ladder and exposure
  ledger… start off with deleting the exposure profile page and the session
  page." The roadmap that replaced them (the "Pinpoint Roadmap" artifact of the
  same day) is a page read top to bottom, band by band:

    Map       the chart with the levels on it, the strike rail as its price
              axis, one toolbar, one sentence; under it the Calendar (the
              Ledger by expiry) and The Day (the Trader's Clock, the Wall
              Report Card)                      — pages/pinpoint/MapDesk.tsx
    Ahead     from now to the close: the range price is likely to hold,
              the odds for the close strike by strike, what dealers must
              buy or sell each half hour (2026-09-06; "the corridor"
              renamed "The range" and the words cut short, 2026-09-07)
                                                — pages/pinpoint/Ahead.tsx
    Building  which of the hedging arrived today, strike by strike — the
              wall a day early — and where the four levels are heading
              at today's pace (2026-09-07)     — pages/pinpoint/Building.tsx
    Targets   the day's agenda: every strike in the order it matters, with
              the two actions (chart · alert)   — pages/pinpoint/RankedTargets.tsx
    Board     everything at a glance: every name the desk covers, one row
              each; a click opens it on the Map — pages/pinpoint/Board.tsx
    Compare   two names on the same reads, side by side; both books on
              one ruler; the two tapes on one percent axis (2026-09-08)
                                                — pages/pinpoint/Compare.tsx

  Old paths redirect to the Map (App.tsx).
*/
export const GEX_SUBPAGES: GexSubpage[] = [
  {
    path: '/pinpoint/map',
    label: 'Map',
    subtitle: 'The day on one chart — price, the dealer levels on it, every strike on the price axis',
    icon: Map,
  },
  {
    path: '/pinpoint/ahead',
    label: 'Ahead',
    subtitle: 'From now to the close — the range price is likely to hold, where it closes, what dealers must buy or sell along the way',
    icon: Hourglass,
  },
  {
    path: '/pinpoint/building',
    label: 'Building',
    subtitle: 'What today added to every strike — walls forming before they are the wall, draining before they break, and where the levels are heading',
    icon: Hammer,
  },
  {
    path: '/pinpoint/wall',
    label: 'At the wall',
    subtitle: 'Whether a wall holds when price gets there, the odds it is reached by the close, and what happens either way',
    icon: BrickWall,
  },
  {
    path: '/pinpoint/targets',
    label: 'Targets',
    subtitle: 'Every strike, in the order it matters today',
    icon: Target,
  },
  {
    path: '/pinpoint/board',
    label: 'Board',
    subtitle: 'Every name at a glance — which way dealers are hedging, the flip, the nearest wall, the supreme, what expires today',
    icon: LayoutGrid,
  },
  {
    path: '/pinpoint/compare',
    label: 'Compare',
    subtitle: 'Two names side by side — the same reads head to head, both books on one ruler, the two tapes on one percent axis',
    icon: Scale,
  },
];
