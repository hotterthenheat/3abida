import { Radio, Bookmark, SlidersHorizontal, Footprints, Eye, Clock, Zap, Layers, Scale, Moon, GitCompareArrows, type LucideIcon } from 'lucide-react';

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
    subtitle: 'Streaming options prints & session flow',
    icon: Radio,
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
    path: '/trace/windows',
    label: 'Windows',
    subtitle: 'The day cut into quarter-hour windows — where the volume actually landed',
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
  // Its own page since 2026-09-12 (Noah: "make a dark pool page in trace") —
  // the crosses left the tape's side rail the same day.
  {
    path: '/trace/dark-pool',
    label: 'Dark Pool',
    subtitle: 'Off-exchange crosses with the read attached — who is behind them, the shelves they left & where the dark money went',
    icon: Moon,
  },
  // Two names on everything Trace knows (Noah, 2026-09-12)
  {
    path: '/trace/compare',
    label: 'Compare',
    subtitle: 'Two names side by side — net flow, the same-day money, the structures, the book & the tape',
    icon: GitCompareArrows,
  },
  {
    path: '/trace/tracker',
    label: 'Tracker',
    subtitle: 'Bookmarked prints & contracts under live watch',
    icon: Bookmark,
  },
];
