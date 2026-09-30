import { Radio, Bookmark, SlidersHorizontal, Footprints, Eye, EyeOff, Clock, Zap, Layers, Scale, Columns2, type LucideIcon } from 'lucide-react';

/** Trace subpage registry — drives the sub-tab bar and command palette. */
export interface TraceSubpage {
  path: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
}

export const TRACE_SUBPAGES: TraceSubpage[] = [
  {
    path: '/trace/live-tape',
    label: 'Live Tape',
    subtitle: 'Streaming options prints, dark-pool crosses & session flow',
    icon: Radio,
  },
  /* Back as its own page (2026-09-13, from the partner's page, in our grammar); the
     tape's rail keeps the crosses too */
  {
    path: '/trace/dark-pool',
    label: 'Dark Pool',
    subtitle: 'Off-exchange crosses with the read attached — who is behind them, the shelves they left & where the dark money went',
    icon: EyeOff,
  },
  // Expansion phase (Noah, 2026-08-30): the flow family grows here — the
  // screener first, net flow / OI explorer / alerts / interval / 0DTE /
  // multi-leg to follow, all reading data/flowBook's one day book.
  {
    path: '/trace/screener',
    label: 'Screener',
    subtitle: "The whole day's option book — screens, filters & every contract that traded",
    icon: SlidersHorizontal,
  },
  {
    path: '/trace/net-flow',
    label: 'Net Flow',
    subtitle: 'Which way each name’s money leans — net premium ranked & charted through the session',
    icon: Scale,
  },
  {
    path: '/trace/footprints',
    label: 'Footprints',
    subtitle: 'What the flow left standing — overnight position builds & unwinds, contract by contract',
    icon: Footprints,
  },
  {
    path: '/trace/watchers',
    label: 'Watchers',
    subtitle: 'The desk watching the tape — a contract surfaces the moment there’s a reason to look',
    /* the eye, not the bell — the bell is the reader's alerts (2026-09-11) */
    icon: Eye,
  },
  {
    /* "Intervals" since 2026-09-19 (Noah: "call the windows page Intervals"); /trace/windows redirects (App.tsx) */
    path: '/trace/intervals',
    label: 'Intervals',
    subtitle: 'The day cut into quarter-hour intervals — where the volume actually landed',
    icon: Clock,
  },
  {
    path: '/trace/odte',
    label: '0DTE',
    subtitle: 'The same-day money — net call & put premium flowing through the session',
    icon: Zap,
  },
  {
    path: '/trace/multi-leg',
    label: 'Multi-Leg',
    subtitle: 'The tape reconstructed into structures — spreads, their legs & their defined risk',
    icon: Layers,
  },
  /* Two names side by side (2026-09-13, from the partner's page, in our grammar):
     the same facts every other Trace page prints, for two names on one cut */
  {
    path: '/trace/compare',
    label: 'Compare',
    subtitle: 'Two names side by side — net flow, the same-day money, the book, the footprints, the structures & the tape, on one cut',
    icon: Columns2,
  },
  // Launch trim (Noah, 2026-08-17): Dark Pool + Scanner pulled from the
  // first launch — pages kept on disk, routes redirect to the tape (which
  // still carries the dark-pool feed).
  {
    path: '/trace/tracker',
    label: 'Tracker',
    subtitle: 'Bookmarked prints & contracts under live watch',
    icon: Bookmark,
  },
];
