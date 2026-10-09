/*
==================================================
  SLAYER TERMINAL - EXPOSURE FIELD
  The exposure matrix's successor — the head the grid
  never had, over the Ledger:

    the head    whose book (with a search to change
                it), the SUPREME as a magenta door
                that pins its strike, fullscreen;
                beneath, GREEK (GEX · DEX · VEX ·
                All), EXPIRIES, STRIKES each side
    the Ledger  ExposureLedger — strike × expiry in
                the house capsules, full: the rows
                share the height, the figure in every
                cell, a fixed read line, hover lights
                the capsule, click pins

  HISTORY, so nobody rebuilds it by accident: the
  redesign arc of 2026-09-03…05 tried a flat SVG
  field, a three.js terrain, the Reach (each expiry
  as a curve at its σ·√T width), the WHEEL (spot at
  the hub, strikes as rings, expiries as rays — "this
  is the one", then removed whole when Noah's
  partners did not approve), a wind map on Plot's
  vector mark, Observable's hexbin on Plot's hexbin
  transform, and a stretched honeycomb with the
  figures inside. Noah closed the arc on 2026-09-05:
  "i feel like im trying too hard to recreate the
  wheel. lets revert back to capsules just make our
  capsules nice and full." The capsules are the view.

  THE BOOK IS BUILT WHOLE (±30) over the calendar and
  the window is a view of it — the presets set it,
  the field scrolls it. Hover any cell for every
  figure at that strike and expiry.
==================================================
*/

import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import Fold from '../ui/Fold';
import ScopeChip from '../ui/ScopeChip';
import ExpiryRangeCard, { type ExpiryDay, type ExpiryShortcut } from '../ui/ExpiryRangeCard';
import { expiryFor } from '../../core/calendar';
import DropdownMulti from '../ui/DropdownMulti';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import LedgerGuide from './LedgerGuide';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Maximize2, Minimize2, Plus, X } from 'lucide-react';
import Simulator from '../../core/simulator';
import TickerLookup from '../ui/TickerLookup';
import useFocusTrap from '../ui/useFocusTrap';
import { useAnchoredMenu } from '../ui/useAnchoredMenu';
import BookRead, { ReadDoor } from './BookRead';
import ExposureLedger from './ExposureLedger';
import ExposureLadder from './ExposureLadder';
import { useResolvedTheme } from '../../theme/theme';
import { GREEK_PICK_OPTIONS, nextGreekPick, pickGreeks, type SurfaceCell } from './exposureView';
import CompanyLogo from '../ui/CompanyLogo';
import TickerSearch from '../ui/TickerSearch';
import { useFadeClose } from '../ui/useFadeClose';
import { fmtUsd } from '../../data/gex';
import { type StrikeWindow } from '../../data/exposure';
import { buildExposureSurface, CALENDAR_DTES, GREEKS, type ExposureSurface, type Greek } from '../../data/exposureSurface';
import { HEAT_MODE } from './heatmap';
import ColoursSwitch from './ColoursSwitch';
import type { MarketSnapshot } from '../../types/market';
import { VIEWS_FOR, readLedgerView, writeLedgerView, type LedgerView } from './ledgerView';
import ExposureMatrix from './ExposureMatrix';

interface ExposureFieldProps {
  /** Null before the first tick — the panel waits rather than throws. */
  snapshot: MarketSnapshot | null | undefined;
  /** Strikes each side of spot. Given: the host's control seeds the window (its own presets stay hidden inline). */
  half?: StrikeWindow;
  hoverStrike?: number | null;
  selectedStrike?: number | null;
  onHoverStrike?: (strike: number | null) => void;
  onSelectStrike?: (strike: number) => void;
  openRatio?: Map<number, number> | null;
  /** Given, the head carries the ticker search — the panel can change whose book it shows */
  onTicker?: (ticker: string) => void;
  /** 'desk' = the Pulse widget's two-row head (name, search, supreme, then the
      strips). 'band' = ONE toolbar row for the Map's Calendar band (2026-09-05):
      the host names the book, so only the strips, the book toggle, the supreme
      door and fullscreen — the "better custom button section" Noah asked for. */
  toolbar?: 'desk' | 'band';
  /** Your positions, strike → the read for it — the ledger marks those rows */
  marks?: ReadonlyMap<number, string>;
  /** What leads the band head — the host's scope chip (which name this book is) */
  lead?: ReactNode;
  /** ONE LENS PER PAGE (Noah, 2026-09-08, "do the sync"): given, the host owns
      the greek — its ladder and this calendar read the same one, and a change
      in either place moves both. Absent, the panel keeps its own (Pulse). */
  /** The greek pick — the greeks ticked, or ['all'] (see exposureView.ts) */
  greeks?: string[];
  onGreeks?: (values: string[]) => void;
  /** Rebuild on every snapshot — the Map's replay hands one in every frame (2026-09-08) */
  fresh?: boolean;
  /** What follows the strips on the band head — the Map's replay transport, so the calendar carries the position */
  after?: ReactNode;
  /** THE FULLSCREEN'S SHAPE (Noah, 2026-09-10: "i really love the full screen
      transition on the two books on one ruler … make that the same for the
      heatmap and ladder"): 'move' = the ruler's own — THIS BOX glides to the
      whole viewport and back on a layout animation, nothing remounts (the Map);
      'portal' = a fixed layer fading in over the page, for hosts whose ancestors
      carry a transform (Pulse's tiles) and would trap a fixed box. */
  fullMode?: 'move' | 'portal';
  /** THE ONE FULLSCREEN BUTTON is the host's (Pulse's tile head, 2026-09-12):
      a one-shot token lifts this box's own fullscreen (its pickers survive,
      which the tile takeover's remount would not give)… */
  fullOpen?: number;
  /** …and while docked under such a head the box's own button stays hidden —
      up, it is the way back beside Esc. The Map keeps its own button. */
  headFull?: boolean;
  /** NAMES SIDE BY SIDE (Noah, 2026-09-12: "multiple names to be shown side by
      side for both the ladder and the calendar layout… up to 4 names max"):
      given, the band carries a Names control and the box splits into a column
      per name — the host's first, up to three more — every column on the one
      band's choices (view · greek · expiries · strikes · show · colours), each
      with its own head, read line and kept strike. Remembered. */
  multi?: boolean;
  /** The kept strike of another column's name, and the pick on it — a strike
      belongs to a name (520 on SPY is not 440 on QQQ) */
  selectedStrikeFor?: (ticker: string) => number | null;
  onSelectStrikeFor?: (ticker: string, strike: number) => void;
  /** The book of a name beside the host's — the host's replay rewinds every
      column through this (the Map hands the minute's snapshot); absent, the
      simulator's live read */
  snapshotFor?: (ticker: string) => MarketSnapshot;
}

/** The names beside the host's — three at most, so four side by side */
const EXTRA_MAX = 3;
const NAMES_KEY = 'slayer_ledger_names';
const GREEKS_KEY = 'slayer_ledger_greeks';
const readNames = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(NAMES_KEY) || '[]');
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string').slice(0, EXTRA_MAX) : [];
  } catch {
    return [];
  }
};
/** The columns' tracks — always four, so a name arriving or leaving is one
    track gliding between 0fr and 1fr, never a grid re-laid at once */
const TRACKS = 1 + EXTRA_MAX;
/** A column leaving glides shut over this, then goes */
const LEAVE_MS = 280;
/** The read fades over this before it goes (the house's close rule: a timer, never an animation's end) */
const READ_CLOSE_MS = 200;
/** With this many names side by side a column's head has no room for quotes or the supreme's total, and a read takes the whole column */
const TIGHT_AT = 3;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** A column's book: the name's snapshot at the moment shown and the surface built from it */
interface ColumnBook {
  ticker: string;
  snapshot: MarketSnapshot;
  surface: ExposureSurface;
}

/** The whole book — every window is a view of it */
const WHOLE_BOOK: StrikeWindow = 30;
/* THE LEDGER'S WINDOWS (2026-09-22, Noah: "i would like 20 to be the default but to have a few more options for the
   user to choose from", then "15 should be the absolute smallest strike size"): 15 · 20 · 25 · 30 each side, 20 by
   rest. The floor of 20 (2026-09-05, "no 10's or 15's") guarded a calendar whose cells went empty at narrow windows;
   the fit rule (2026-09-14) guards that now, and 15 is his floor. 30 is every strike the chain has. */
const LEDGER_WINDOWS: StrikeWindow[] = [15, 20, 25, 30];
const LEDGER_REST: StrikeWindow = 20;
/* THE CEILING OF EXPIRIES by greeks side by side (Noah, 2026-09-22: "7 being the max when you are choosing all 5
   greeks"): the most the band draws at once, whatever the width — the page never changes shape by itself */
const EXPIRY_CEILING: Record<number, number> = { 1: 20, 2: 15, 3: 10, 4: 8, 5: 7 };
/** What the columns are drawn from — one snapshot of the picks that change the book's SHAPE (the soft swap) */
interface DrawnShape {
  view: LedgerView;
  rings: number;
  greeks: Greek[];
  range: { from: number; through: number };
  afterBell: boolean;
}
/** The old shape's fade-out; the new one's fade-in is index.css's view-in (320ms) */
const SWAP_OUT_MS = 160;
/** THE BAND'S ROOM (measured 2026-09-22 with the cards at rest, all five greeks, seven expiries): the picks need
    989px with their names and ~700 bare; the doors 644 with their words and ~390 compact (the supreme as its strike,
    the read and the guide as their icons). ONE ROW, as long as it can be one row (Noah, on the landing still's second
    row: "top buttons are being kicked out and placed underneath"): named at 1,672 and up, the picks BARE from 1,390
    (a desk with the sidebar open), the doors COMPACT too from 1,140 (the landing's still, the rail folded); only
    under that two tidy rows, the picks bare under 1,021 there too. Names in the tooltips throughout. */
const BAND_ONE_ROW_PX = 1672;
const BAND_BARE_ROW_PX = 1390;
const BAND_TIGHT_ROW_PX = 1140;
const BAND_NAMED_ROW_PX = 1021;
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const GREEK_LABEL: Record<Greek, string> = { gex: 'GEX', dex: 'DEX', vex: 'VEX', vanna: 'VANNA', charm: 'CHARM' };
/*
  THE HEAD IN THE APPROVED GRAMMAR (Noah, 2026-09-06: "our heatmap header
  needs a fixing. the buttons are quite horrid"): one thin line of labelled
  DROPDOWN CARDS, one plain line under every choice, never a row of chips.
  Expiries are spelled as DATES ("Through Sep 18"), not counts — it is not a
  date picker, because the calendar shows many expiries side by side and the
  choice is how far along it to read, but the choice should read as a date.
*/
/* The greeks are a MULTI pick now (Noah, 2026-09-10: "you can either choose 1
   or 2 or 3 or 4 or all") — the options and the pick rules live in
   exposureView.ts, shared with the Map's head. */
const GREEK_GROUPS = [{ title: 'What the cells measure', options: GREEK_PICK_OPTIONS }];
/* the five alone — a column beside another name shows one greek at a time */
const SINGLE_GREEK_OPTIONS: DropdownOption<string>[] = GREEK_PICK_OPTIONS.filter(o => o.value !== 'all').map(o => ({ value: o.value, label: o.label, hint: o.hint }));
/* THE COLOURS SWITCH is components/gex/ColoursSwitch.tsx — shared with the Pulse strike ladder (2026-09-22) */
/* THE VIEW (Noah, 2026-09-10, his partner's "inventory & sensitivity by
   strike": "the net, put, call ratios with the bar for each section looks
   good. make a new button that allows for either the heatmap or this") —
   the same book two ways: the calendar's capsules by strike and expiry, or
   one row per strike with the put and call legs, the net and a bar.
   WHICH ONE A HOST OPENS ON, and where its pick is kept, is ledgerView.ts:
   the Map opens on the ladder, the Pulse tile on the calendar. */
/* THE SWITCH BETWEEN THE VIEWS IS A CUT WITH THE HOUSE'S FADE (2026-09-22). The flight of pieces built 2026-09-13 —
   the ladder's bars cut into capsules and flown to the calendar and back — went at Noah's word: "way too laggy and
   doesn't work as i would like". The arriving view fades in over the house's 200ms; nothing is cloned, measured or
   flown. */
const VIEW_OPTION: Record<LedgerView, DropdownOption<LedgerView>> = {
  matrix: { value: 'matrix', label: 'Matrix', hint: 'One row per strike — every greek split put · call · net, a figure and its bar in each cell' },
  calendar: { value: 'calendar', label: 'Calendar', hint: 'Strike by expiry — every cell a capsule' },
  ladder: { value: 'ladder', label: 'Ladder', hint: 'One row per strike — the put leg, the call leg, the net, and a bar' },
};
const SHOW_OPTIONS: DropdownOption<'now' | 'after'>[] = [
  { value: 'now', label: 'Now', hint: 'The calendar as it stands' },
  { value: 'after', label: 'After the close', hint: "The same calendar once today's contracts have expired" },
];

const ExposureField = ({ snapshot, half: halfProp, hoverStrike, selectedStrike, onHoverStrike, onSelectStrike, openRatio, onTicker, toolbar = 'desk', marks, lead, greeks: greeksProp, onGreeks, fresh = false, after, fullMode = 'portal', fullOpen, headFull = false, multi = false, selectedStrikeFor, onSelectStrikeFor, snapshotFor }: ExposureFieldProps) => {
  const [ownPick, setOwnPick] = useState<string[]>(['gex']);
  const pick = greeksProp ?? ownPick;
  /* the page's theme: on paper the island and everything drawn in it wear the light set and the paper ramps */
  const paper = useResolvedTheme() === 'light';
  const setPick = (next: string[]) => {
    const settled = nextGreekPick(pick, next);
    setOwnPick(settled);
    onGreeks?.(settled);
  };
  /* The greeks drawn — a stable array per pick, so the grid and the ladder memo on it */
  const greeks = useMemo(() => pickGreeks(pick), [pick]);
  /* THE WINDOW OF EXPIRIES (Noah, 2026-09-22: "it forces you to start from the current date and goes through to the
     date you choose… there should be some sort of max, 7 being the max when you are choosing all 5 greeks"): From and
     Through, as indices into the book's expiries, nearest first. THE CEILING is by how many greeks stand side by side —
     seven with five, more with fewer — and the window is clamped to it whenever the pick changes, so the page never
     draws more than it said it would. What FITS at the width still cuts under the ceiling (below). */
  const ceiling = EXPIRY_CEILING[Math.min(5, Math.max(1, greeks.length))] ?? 7;
  const [range, setRange] = useState<{ from: number; through: number }>({ from: 0, through: Math.min(7, ceiling - 1) });
  useEffect(() => {
    setRange(r => (r.through - r.from + 1 > ceiling ? { from: r.from, through: r.from + ceiling - 1 } : r));
  }, [ceiling]);
  /* WHAT FITS (Noah, 2026-09-14: three names through Oct 26 left every capsule empty — "reads as
     a website bug/flaw"): each calendar pane reports how many expiries it can print at its
     measured width with its greeks (ExposureLedger `onFit`); the band draws no deeper than the
     least of them, and its Expiries card offers no deeper — an empty capsule is never on the
     screen, whatever the window, the sidebar, the names or the greeks do. Infinity until a pane
     has measured, and on the ladder (no capsules there). */
  const fitRef = useRef(new Map<string, number>());
  const [fitDepth, setFitDepth] = useState<number>(Infinity);
  const reportFit = useCallback((key: string, n: number | null) => {
    if (n == null) fitRef.current.delete(key);
    else fitRef.current.set(key, n);
    let min = Infinity;
    for (const v of fitRef.current.values()) if (v < min) min = v;
    setFitDepth(prev => (prev === min ? prev : min));
  }, []);
  /* BOOK AFTER THE BELL (the roadmap's band 3, 2026-09-05): today's column
     taken out — the book as it stands at the next open. The ledger says how
     much of the book that is. */
  const [afterBell, setAfterBell] = useState(false);
  /* THE PALETTE, a try (Noah, 2026-09-05: "can we try the thermal design
     just for a try") — the thermal leads while it is on trial; the house
     ramp is one click away. Only this grid reads it. */
  const [palette, setPalette] = useState<'house' | 'thermal'>('thermal');
  /* THE VIEW — the calendar, or the ladder (one row per strike); remembered per host (ledgerView.ts):
     the Map's band opens on the ladder, the Pulse tile on the calendar */
  const viewHost = toolbar === 'band' ? 'map' : 'tile';
  const [view, setView] = useState<LedgerView>(() => readLedgerView(viewHost));
  /** The expiry columns drawn for a book, nearest first: the window, without today after the bell, then the
      ceiling, then what fits (every pane reports its own; the least wins) — read off a shape (the live picks for the
      card's words, the drawn snapshot for the columns; see the soft swap below) */
  const windowFor = (surface: ExposureSurface, sh: { range: { from: number; through: number }; afterBell: boolean; greeks: Greek[] }): number[] => {
    const todayIdx = surface.expiries.findIndex(e => e.dte === 0);
    const last = surface.expiries.length - 1;
    const lo = Math.max(0, Math.min(sh.range.from, last));
    const hi = Math.max(lo, Math.min(sh.range.through, last));
    const all = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const live = sh.afterBell && todayIdx >= 0 ? all.filter(i => i !== todayIdx) : all;
    const cap = EXPIRY_CEILING[Math.min(5, Math.max(1, sh.greeks.length))] ?? 7;
    return (live.length ? live : all.slice(0, 1)).slice(0, cap);
  };
  const shownFor = (surface: ExposureSurface, sh: { range: { from: number; through: number }; afterBell: boolean; greeks: Greek[] }): number[] => windowFor(surface, sh).slice(0, Math.max(1, fitDepth));
  const pickView = (v: LedgerView) => {
    setView(v);
    writeLedgerView(viewHost, v);
  };
  /* the band's measured width — what its head lays itself out by (see `bandRows`); read before the first paint, so
     the head never opens ragged and then mends itself */
  const bandRO = useRef<ResizeObserver | null>(null);
  const [bandW, setBandW] = useState(0);
  const bandRef = useCallback((el: HTMLDivElement | null) => {
    bandRO.current?.disconnect();
    bandRO.current = null;
    if (!el) return;
    setBandW(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(entries => setBandW(Math.round(entries[0].contentRect.width)));
    ro.observe(el);
    bandRO.current = ro;
  }, []);
  /* THE STRIKES: each side of spot — the ledger's own presets, 20 by rest; a host may seed its own */
  const seed: number = halfProp ?? LEDGER_REST;
  const [rings, setRings] = useState<number>(seed);
  useEffect(() => setRings(seed), [seed]);
  /* THE SOFT SWAP (Noah, 2026-09-22, right after the flight went: "the transitions between the views and the
     transitions of strikes and greek amounts need to be smooth, right now everything changes way too quickly"): a
     change of WHAT IS DRAWN — the view, the strikes, the greeks, the expiry window, the bell — is never a cut. The
     body fades out on the old shape (SWAP_OUT_MS), then the new shape mounts and fades in (index.css view-in); the
     cards up top show the new pick at once. The columns render from ONE SNAPSHOT of the shape (`drawn`), and the
     live picks catch up as the fade lands. Nothing is cloned or measured — two short opacity fades, cheap at any
     size. Reduced motion: the cut. */
  const liveShape: DrawnShape = { view, rings, greeks, range, afterBell };
  const liveKey = `${view}|${rings}|${greeks.join(',')}|${range.from}-${range.through}|${afterBell ? 'a' : 'n'}`;
  const [drawn, setDrawn] = useState<{ key: string; shape: DrawnShape }>({ key: liveKey, shape: liveShape });
  const [fading, setFading] = useState(false);
  const [swapped, setSwapped] = useState(false);
  useEffect(() => {
    if (liveKey === drawn.key) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDrawn({ key: liveKey, shape: liveShape });
      return;
    }
    setFading(true);
    const t = window.setTimeout(() => {
      setDrawn({ key: liveKey, shape: liveShape });
      setFading(false);
      setSwapped(true);
    }, SWAP_OUT_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);
  const d = drawn.shape;
  /* THE GUIDE AS A FOCUS (Noah, 2026-09-06, after the Map's: "i love this,
     keep it in the design pattern style. i think the heatmap needs one as
     well"): the card centred over the calendar, the grid blurred behind it;
     Esc (captured, so fullscreen stays) or a click on the blur lets go. */
  const [guideOpen, setGuideOpen] = useState(false);
  /* THE READ (2026-09-12, BookRead.tsx): the book's read as a glass card over
     the right of the ladder or the calendar. The pointer's strike goes to it
     through a ref — only the card re-renders on a move, never the grid.
     A READ PER NAME (Noah, 2026-09-13: "the read card on multiple ticker
     cards… should that be an in-card design because right now it just
     defaults to the left one"): each column's head carries its own door and
     its read opens over its own book — two can stand open side by side. Kept
     by name; a closing read fades on a timer before it goes. */
  const [reads, setReads] = useState<Record<string, 'open' | 'closing'>>({});
  const readTimers = useRef<Record<string, number>>({});
  useEffect(() => () => Object.values(readTimers.current).forEach(id => window.clearTimeout(id)), []);
  const readOf = (t: string) => reads[t];
  const closeRead = (t: string) => {
    setReads(r => (r[t] === 'open' ? { ...r, [t]: 'closing' } : r));
    window.clearTimeout(readTimers.current[t]);
    readTimers.current[t] = window.setTimeout(() => {
      setReads(r => {
        if (r[t] !== 'closing') return r;
        const next = { ...r };
        delete next[t];
        return next;
      });
    }, READ_CLOSE_MS);
  };
  const toggleRead = (t: string) => {
    if (reads[t] === 'open') closeRead(t);
    else {
      window.clearTimeout(readTimers.current[t]);
      setReads(r => ({ ...r, [t]: 'open' }));
    }
  };
  /* THE POINTER FEED OF EACH COLUMN — the host's through `pointedRef` (the
     chart's ladder washes with it too), the others' by name: a read card
     subscribes to its own column's rows and nothing else re-renders on a move */
  const pointedFor = useRef(new Map<string, (strike: number | null) => void>());
  const subscribers = useRef(new Map<string, (fn: (strike: number | null) => void) => () => void>());
  const subscribeFor = (t: string) => {
    let s = subscribers.current.get(t);
    if (!s) {
      s = fn => {
        pointedFor.current.set(t, fn);
        return () => {
          if (pointedFor.current.get(t) === fn) pointedFor.current.delete(t);
        };
      };
      subscribers.current.set(t, s);
    }
    return s;
  };
  /* THE LANE IN FOCUS (Noah, 2026-09-12): with several greeks on the ladder the
     lead greek's lane wears the holo ring; a click on a lane's head picks it.
     The read card and the read line's verdict follow the lead. Falls back to
     the first greek drawn when the pick leaves the ladder. */
  const [leadPick, setLeadPick] = useState<Greek | null>(null);
  const leadGreek: Greek = leadPick && greeks.includes(leadPick) ? leadPick : greeks[0];
  const pointedRef = useRef<((strike: number | null) => void) | null>(null);
  const subscribePointed = useCallback((fn: (strike: number | null) => void) => {
    pointedRef.current = fn;
    return () => {
      if (pointedRef.current === fn) pointedRef.current = null;
    };
  }, []);
  /* FULLSCREEN — portaled to <body>, edge to edge, Esc leaves, the page
     scroll locks under it. */
  const [full, setFull] = useState(false);
  /* IN AND OUT OVER HALF A SECOND, not the chart's 200ms (Noah, 2026-09-10:
     "the full screen of both the heatmap and the ladder is very quick
     transition but it should be smooth") — the slow soft-in on the way up,
     a 400ms fade on the way down; opacity only, never a transform. */
  const { closing, close: fadeClose } = useFadeClose(() => {
    setFull(false);
    onHoverStrike?.(null);
  }, 400);
  /* the moving box needs no fade — the layout animation IS the way back */
  const close = fullMode === 'move'
    ? () => {
        setFull(false);
        onHoverStrike?.(null);
      }
    : fadeClose;
  /* the host's tile head asked for it */
  useEffect(() => {
    if (fullOpen) setFull(true);
  }, [fullOpen]);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) close();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [full, close]);

  /* THE BOOK, REBUILT WHEN IT MATTERS (2026-09-06, the perf sweep): fifteen
     expiries × a priced chain each, plus the grid's re-render, was ~50ms on
     EVERY 1.5s tick in dev — the one long task left at idle. Open interest
     moves slowly; a rebuild happens when spot has moved a tenth of a percent
     since the last one, when six seconds have passed, or when the name
     changes. The head's price and change stay live off the snapshot, and
     the ledger's spot rule reads the live spot too. */
  const builtRef = useRef<{ surface: ExposureSurface; spot: number; at: number } | null>(null);
  const surface = useMemo(() => {
    if (!snapshot) return null;
    const b = builtRef.current;
    const now = Date.now();
    if (!fresh && b && b.surface.ticker === snapshot.ticker && Math.abs(snapshot.spot - b.spot) / b.spot < 0.001 && now - b.at < 6000) return b.surface;
    const next = buildExposureSurface(snapshot, WHOLE_BOOK, CALENDAR_DTES);
    builtRef.current = { surface: next, spot: snapshot.spot, at: now };
    return next;
  }, [snapshot]);

  /* THE NAMES BESIDE THE HOST'S — kept on this machine; a name the host
     already shows is never doubled. Their books are the simulator's pure read,
     rebuilt whenever the host's surface is (the same cadence), so the columns
     never disagree about the moment. */
  const [extra, setExtra] = useState<string[]>(() => (multi ? readNames() : []));
  const hostTicker = surface?.ticker ?? snapshot?.ticker ?? '';
  const names = useMemo(() => extra.filter(t => t !== hostTicker), [extra, hostTicker]);
  const writeNames = (next: string[]) => {
    setExtra(next);
    try {
      localStorage.setItem(NAMES_KEY, JSON.stringify(next));
    } catch {
      /* storage off — the choice lives for the session */
    }
  };
  /* A COLUMN LEAVES BY GLIDING SHUT (Noah, 2026-09-13: "the exiting and
     entering of these things… should be smooth and quick, not jittery"): a
     name taken off stays in its slot as a leaving column — its track at 0fr,
     its panel fading — for LEAVE_MS, then goes; the columns after it slide
     over on real layout. `order` keeps every column in the slot it had. */
  const [leaving, setLeaving] = useState<Record<string, true>>({});
  const leaveTimers = useRef<Record<string, number>>({});
  useEffect(() => () => Object.values(leaveTimers.current).forEach(id => window.clearTimeout(id)), []);
  const orderRef = useRef<string[]>([]);
  const addName = (sym: string) => {
    const t = sym.toUpperCase();
    if (!t || t === hostTicker || extra.includes(t) || names.length >= EXTRA_MAX) return;
    window.clearTimeout(leaveTimers.current[t]);
    setLeaving(l => {
      if (!l[t]) return l;
      const next = { ...l };
      delete next[t];
      return next;
    });
    writeNames([...extra, t]);
  };
  const removeName = (t: string) => {
    writeNames(extra.filter(x => x !== t));
    setReads(r => {
      if (!r[t]) return r;
      const next = { ...r };
      delete next[t];
      return next;
    });
    setLeaving(l => ({ ...l, [t]: true }));
    window.clearTimeout(leaveTimers.current[t]);
    leaveTimers.current[t] = window.setTimeout(() => {
      setLeaving(l => {
        const next = { ...l };
        delete next[t];
        return next;
      });
    }, LEAVE_MS);
  };
  /* A NAME CHANGED IN PLACE — the column's own chip picked another: the same
     slot, the new book; its greek and its read are the new name's own */
  const renameName = (t: string, sym: string) => {
    const next = sym.toUpperCase();
    if (!next || next === t || next === hostTicker || extra.includes(next)) return;
    orderRef.current = orderRef.current.map(x => (x === t ? next : x));
    writeNames(extra.map(x => (x === t ? next : x)));
  };
  /* EACH NAME ITS OWN GREEK (Noah, 2026-09-12: "they should be allowed to
     follow different greeks"): with names side by side the band's Greek card
     steps down and every column's head carries its own — the host's bound to
     the page's greek, the others kept here by name (`slayer_ledger_greeks`) */
  const [greekByName, setGreekByName] = useState<Record<string, string[]>>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(GREEKS_KEY) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  });
  const greeksOf = (t: string): string[] => greekByName[t] ?? ['gex'];
  const setGreeksOf = (t: string, next: string[]) => {
    const settled = nextGreekPick(greeksOf(t), next);
    const all = { ...greekByName, [t]: settled };
    setGreekByName(all);
    try {
      localStorage.setItem(GREEKS_KEY, JSON.stringify(all));
    } catch {
      /* storage off — the choice lives for the session */
    }
  };
  /* A NAME NEVER READ BEFORE LANDS AFTER THE GLIDE: the simulator walks a new
     name's history in on the main thread (~0.6s) the first time it is asked
     for, and nothing on screen moves meanwhile — so a cold name's column
     opens at once with a skeleton inside, and its book is asked for on a
     timer once the columns have settled (one name at a time, the Board's
     rule); a name the terminal already carries builds on the spot. */
  const [warmed, setWarmed] = useState(0);
  const warmedRef = useRef(new Set<string>());
  const extraBooks = useMemo(() => {
    if (!multi || !surface) return [];
    const out: { ticker: string; book: ColumnBook | null }[] = [];
    for (const t of names) {
      if (!Simulator.TICKERS[t]) {
        /* cold: a skeleton until warmed; warmed and still not there, the column goes */
        if (!warmedRef.current.has(t)) out.push({ ticker: t, book: null });
        continue;
      }
      try {
        /* the host says which moment — the Map's replay rewinds every column */
        const snap = (snapshotFor ?? Simulator.snapshotFor)(t);
        out.push({ ticker: t, book: { ticker: t, snapshot: snap, surface: buildExposureSurface(snap, WHOLE_BOOK, CALENDAR_DTES) } });
      } catch {
        /* a name the sim can't build — the column is skipped */
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multi, names, surface, snapshotFor, warmed]);
  useEffect(() => {
    const cold = extraBooks.filter(c => !c.book && !warmedRef.current.has(c.ticker)).map(c => c.ticker);
    if (!cold.length) return;
    let cancelled = false;
    let timer = 0;
    const run = (i: number) => {
      timer = window.setTimeout(
        () => {
          if (cancelled) return;
          const t = cold[i];
          try {
            Simulator.snapshotFor(t);
          } catch {
            /* the sim can't build it — the column goes on the next build */
          }
          warmedRef.current.add(t);
          setWarmed(n => n + 1);
          if (i + 1 < cold.length) run(i + 1);
        },
        i === 0 ? LEAVE_MS + 60 : 40
      );
    };
    run(0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [extraBooks]);
  /* the last book of every name, so a leaving column still has one to draw while it glides shut */
  const lastBooks = useRef(new Map<string, ColumnBook>());
  for (const c of extraBooks) if (c.book) lastBooks.current.set(c.ticker, c.book);
  /* THE COLUMNS IN THEIR SLOTS: the names present, the leaving ones still in
     place, a new name at the end */
  const present = new Map(extraBooks.map(c => [c.ticker, c]));
  orderRef.current = [...orderRef.current.filter(t => present.has(t) || leaving[t]), ...extraBooks.map(c => c.ticker).filter(t => !orderRef.current.includes(t))];
  const columns = orderRef.current
    .filter(t => present.has(t) || leaving[t])
    .map(t => ({ ticker: t, book: present.get(t)?.book ?? lastBooks.current.get(t) ?? null, host: false, leaving: !present.has(t) }));
  /* ADD A NAME — the Board's own menu: the trigger on the band, the lookup in a portal */
  const [adding, setAdding] = useState(false);
  const addRootRef = useRef<HTMLSpanElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const { anchorRef: addAnchor, placed: addPlaced } = useAnchoredMenu<HTMLButtonElement>(adding, 'bottom', 288, 'start');
  useFocusTrap(adding, addMenuRef);
  useEffect(() => {
    if (!adding) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (addRootRef.current?.contains(t) || addMenuRef.current?.contains(t)) return;
      setAdding(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setAdding(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [adding]);

  const supremeGreek: Greek = greeks[0] ?? 'gex';
  if (!snapshot || !surface) {
    return (
      <div className="h-full min-h-[300px] grid place-items-center font-mono text-[11px] text-textMuted">
        Waiting for the first tick
      </div>
    );
  }
  /* The SUPREME is the heaviest STRIKE of the whole book — the one the chart
     wears in magenta — shown with the date carrying most of it. The heaviest
     single cell is the grid's star, a different fact with its own plain name. */
  const supreme = surface.supreme[supremeGreek];
  const supremeEx = surface.expiries[supreme.e];
  const liveChange = snapshot.changePercent;
  const up = liveChange >= 0;
  /* the expiries drawn for the host's book: the window, the ceiling, what fits (see `windowFor`) */
  const shownIdx = shownFor(surface, { range, afterBell, greeks });
  const ex = surface.expiries;
  /* THE CALENDAR IS THE CONTROL (Noah, 2026-09-12: "i dont even see the
     calendar page"): every expiry the book holds is a lit day; since
     2026-09-22 the card picks a WINDOW of them — From and Through — with
     shortcuts, and says the ceiling. */
  const beside = extraBooks.length > 0 ? ` beside ${1 + extraBooks.length} names` : '';
  const expiryDays: ExpiryDay[] = ex.map((e, i) => ({
    value: i,
    date: expiryFor(e.dte).date,
    label: e.dte === 0 ? 'Today' : e.date,
    hint: e.dte === 0 ? `${e.date} — the contracts that expire at the bell` : `${e.date} — ${e.dte} ${e.dte === 1 ? 'day' : 'days'} out`,
  }));
  const lastIdx = Math.max(0, ex.length - 1);
  const weekEnd = ex.reduce((last, e, i) => (e.dte <= 5 ? i : last), 0);
  const shortcuts: ExpiryShortcut[] = [
    { label: 'Today only', hint: 'The contracts that expire at the bell', from: 0, through: 0 },
    { label: 'This week', hint: 'Every expiry inside the week', from: 0, through: Math.min(weekEnd, ceiling - 1) },
    { label: `Next ${Math.min(7, ceiling, ex.length)}`, hint: `The nearest ${Math.min(7, ceiling, ex.length)} expiries`, from: 0, through: Math.min(6, ceiling - 1, lastIdx) },
  ];
  const ceilingWhy = greeks.length >= 5 ? `${ceiling} at most with five greeks` : greeks.length === 1 ? `up to ${Math.min(ceiling, ex.length)} with one greek` : `${ceiling} at most with ${greeks.length} greeks`;
  const wanted = windowFor(surface, { range, afterBell, greeks }).length;
  const fitNote = wanted > shownIdx.length ? `Only ${shownIdx.length} of the ${wanted} expiries you chose fit${beside} at this width — ${extraBooks.length > 0 ? 'take a name off or widen the window' : 'widen the window'} to see the rest.` : undefined;
  /* THE BAND SAYS WHAT IS TRUE OF EVERY COLUMN; THE COLUMN SAYS WHAT IS TRUE
     OF ITS NAME (Noah, 2026-09-13: "with multiple tickers doesn't that mean
     the top left ticker shouldn't exist? only when the user decides to click
     out the other 2 then the last one should reoccur and take that spot"):
     with names side by side the band's per-name pieces — the scope chip, the
     Greek card, the supreme fact, the read's door — FOLD SHUT on the band as
     every column's head unfolds with its own; the last column taken off, they
     fold back open in their spots. Folds, not glides: nothing scales, nothing
     remounts, the neighbours slide over on real layout. */
  const many = extraBooks.length > 0;
  const tight = 1 + extraBooks.length >= TIGHT_AT;
  /* the band's mode by its measured width (see BAND_*_ROW_PX); the desk toolbar (Pulse) has no band and never
     measures, so its cards keep their names */
  const bandMode: 'one' | 'bare' | 'tight' | 'two' = bandW === 0 || bandW >= BAND_ONE_ROW_PX ? 'one' : bandW >= BAND_BARE_ROW_PX ? 'bare' : bandW >= BAND_TIGHT_ROW_PX ? 'tight' : 'two';
  const stripsBare = toolbar === 'band' && (bandMode === 'bare' || bandMode === 'tight' || (bandMode === 'two' && bandW < BAND_NAMED_ROW_PX));
  const doorsTight = toolbar === 'band' && bandMode === 'tight';
  const strips = (
    <>
      <DropdownSelect label="View" value={view} options={VIEWS_FOR[viewHost].map(v => VIEW_OPTION[v])} onChange={pickView} title="The matrix, the calendar, or the ladder" testId="ledger-view" bare={stripsBare} />
      {/* with names side by side the greek steps down to each column's head */}
      <Fold open={!many} gap={8} testId="data-band-greek">
        <DropdownMulti label="Greek" values={pick} groups={GREEK_GROUPS} onChange={setPick} emptyWord="All" title="One, some, or all five" testId="ledger-greek" align="start" bare={stripsBare} />
      </Fold>
      <ExpiryRangeCard label="Expiries" days={expiryDays} from={range.from} through={range.through} onChange={(from, through) => setRange({ from, through })} ceiling={ceiling} ceilingWhy={ceilingWhy} shortcuts={shortcuts} title="Which expiries the book reads" testId="ledger-expiries" note={fitNote} bare={stripsBare} />
      <DropdownSelect
        label="Strikes"
        value={rings}
        options={LEDGER_WINDOWS.map(w => ({ value: w as number, label: `${w} each side`, hint: w === 30 ? `Every strike the chain has — ${w * 2 + 1} rows` : `${w * 2 + 1} rows — ${w} strikes above spot and ${w} below` }))}
        onChange={setRings}
        title="How many strikes around spot"
        testId="ledger-strikes"
        bare={stripsBare}
      />
      <DropdownSelect label="Show" value={afterBell ? 'after' : 'now'} options={SHOW_OPTIONS} onChange={v => setAfterBell(v === 'after')} title="Which calendar" testId="ledger-show" bare={stripsBare} />
      <ColoursSwitch palette={palette} onChange={setPalette} paper={paper} bare={stripsBare} testId="ledger-colours" />
    </>
  );
  const supremeDoor = (
    <button
      onClick={() => onSelectStrike?.(supreme.strike)}
      title={`The heaviest strike of the whole book by ${GREEK_LABEL[supremeGreek]} — the one the chart wears in magenta — most of it on ${supremeEx?.date ?? ''} · click to pin the strike`}
      className="ml-auto inline-flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-supreme/40 bg-supreme/[0.06] hover:bg-supreme/[0.12] font-mono transition-colors"
      data-ledger-supreme={doorsTight ? 'compact' : 'full'}
    >
      <span className="text-[11px] font-bold text-supreme">Supreme</span>
      <span className="text-[12px] font-semibold tnum text-textPrimary whitespace-nowrap">
        {fmtStrike(supreme.strike)}
        {/* tight: the strike alone — the date and the amount stay in the title */}
        {!doorsTight && (
          <>
            {' '}
            <span className="text-textMuted font-normal">·</span> {supremeEx?.date ?? ''} <span className="text-textMuted font-normal">·</span> {fmtUsd(supreme.total)}
          </>
        )}
      </span>
    </button>
  );
  const guideButton = <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the grid means" testId="ledger-guide" compact={doorsTight} />;
  /* THE READ's door — beside the guide's; lit while the card is up. The band's opens the host's read */
  const readDoor = <ReadDoor open={readOf(surface.ticker) === 'open'} onClick={() => toggleRead(surface.ticker)} compact={doorsTight} />;
  const fullButton =
    headFull && !full ? null : (
      <button
        onClick={() => (full ? close() : setFull(true))}
        title={full ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
        className="shrink-0 p-1.5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
      >
        {full ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    );
  const backButton = full ? (
    <button
      onClick={close}
      className="group inline-flex items-center gap-1.5 border border-borderSubtle hover:border-borderMuted rounded-md px-2.5 py-1 font-mono text-[11px] text-textSecondary hover:text-textPrimary transition-colors"
    >
      <ArrowLeft className="w-3 h-3 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" /> Back
    </button>
  ) : null;

  /* THE BAND HEAD KNOWS ITS ROOM (Noah, 2026-09-22, the landing's Map still at 1440: "the top of the images… have
     unorganized buttons like we had before" — the one row wrapped wherever it ran out, leaving the supreme, the read
     and the doors ragged on a second line; then, on two tidy rows: "top buttons are being kicked out and placed
     underneath"). Measured off the band itself, before the first paint, the Weigher's way: ONE ROW for as long as
     it can be one — the picks bare, then the doors compact — and only under that TWO TIDY ROWS: the picks (the
     name, view, greek, expiries, strikes, show, colours) on the first, the doors (names, replay, the supreme, the
     read, how to read, fullscreen) on the second, the fullscreen door last on either. See BAND_*_ROW_PX. */
  const bandRows: 'one' | 'two' = bandMode === 'two' ? 'two' : 'one';
  const leadFold = lead ? (
    <Fold open={!many} gap={8} testId="data-band-lead">
      <span className="shrink-0 inline-flex items-center">{lead}</span>
    </Fold>
  ) : null;
  const namesDoor = multi && (
        <span ref={addRootRef} className="relative inline-flex">
          <button
            ref={addAnchor}
            type="button"
            onClick={() => setAdding(v => !v)}
            aria-expanded={adding}
            disabled={names.length >= EXTRA_MAX}
            title={names.length >= EXTRA_MAX ? 'Four names at most — take one off to add another' : 'Show another name beside this one — up to four side by side'}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border bg-chip transition-colors font-mono select-none disabled:opacity-50 ${adding ? 'border-silver/50' : 'border-borderSubtle hover:border-borderMuted'}`}
            data-ledger-add
          >
            <Plus className="w-3 h-3 text-textMuted" />
            <span className="text-[11px] text-textMuted">Names</span>
            <span className="text-[11px] font-semibold text-textPrimary tnum">{1 + names.length}</span>
          </button>
          {adding &&
            addPlaced &&
            createPortal(
              <div
                ref={addMenuRef}
                role="dialog"
                aria-label="Show another name beside this one"
                style={{ position: 'fixed', ...addPlaced.box }}
                className="z-[120] w-72 border border-borderMuted bg-panel/80 backdrop-blur-xl backdrop-saturate-150 rounded-md shadow-2xl shadow-black/60 overflow-x-hidden overflow-y-auto overscroll-contain animate-slide-in"
                data-ledger-add-menu
              >
                <div className="px-2.5 py-1.5 border-b border-borderSubtle text-[11px] text-textMuted">Show another name beside this one — up to four side by side, on the same choices</div>
                <TickerLookup
                  onPick={sym => {
                    addName(sym);
                    setAdding(false);
                  }}
                />
              </div>,
              document.body
            )}
        </span>
      );
  /* the supreme and the read are one name's — they step down into the columns' heads with the chip */
  const doors = (
    <>
      {namesDoor}
      {after}
      <Fold open={!many} gap={8} className="ml-auto" testId="data-band-supreme">
        {supremeDoor}
      </Fold>
      <Fold open={!many} gap={8} testId="data-band-read">
        {readDoor}
      </Fold>
      {guideButton}
      {fullButton}
    </>
  );
  const head = toolbar === 'band' ? (
    bandRows === 'one' ? (
      <div ref={bandRef} className="shrink-0 flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-1.5 border-b border-borderSubtle/60 bg-panel" data-ledger-toolbar data-ledger-toolbar-rows="one" data-ledger-toolbar-mode={bandMode}>
        {backButton}
        {leadFold}
        {strips}
        {doors}
      </div>
    ) : (
      <div ref={bandRef} className="shrink-0 flex flex-col gap-y-1.5 px-3 py-1.5 border-b border-borderSubtle/60 bg-panel" data-ledger-toolbar data-ledger-toolbar-rows="two" data-ledger-toolbar-mode={bandMode}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5" data-ledger-toolbar-row="picks">
          {backButton}
          {leadFold}
          {strips}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5" data-ledger-toolbar-row="doors">
          {doors}
        </div>
      </div>
    )
  ) : (
    <div className="shrink-0 border-b border-borderSubtle/60">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 pt-2 pb-1.5">
        {backButton}
        {/* The name, its price, its change — the panel says whose book this is; the search changes whose. */}
        <span className="inline-flex items-center gap-2 font-mono">
          <CompanyLogo ticker={surface.ticker} size={18} />
          <span className="text-[14px] font-bold text-textPrimary">{surface.ticker}</span>
          <span className="text-[12px] tnum text-textPrimary">${snapshot.spot.toFixed(2)}</span>
          <span className={`text-[11px] tnum ${up ? 'text-bull' : 'text-bear'}`}>
            {up ? '+' : ''}
            {liveChange.toFixed(2)}%
          </span>
        </span>
        {onTicker && <TickerSearch value={surface.ticker} onChange={onTicker} />}
        {/* The supreme — one door, the supreme ink, the thing the eye lands on. */}
        {supremeDoor}
        {readDoor}
        {fullButton}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 pb-2">{strips}</div>
    </div>
  );

  // The host's ladder washes the same strike — the only thing the pointer leaves the panel for
  const onPointer = (cell: SurfaceCell | null) => {
    pointedRef.current?.(cell?.strike ?? null);
    onHoverStrike?.(cell?.strike ?? null);
  };
  /* the host first, then every column in its slot — a leaving one at 0fr */
  const allColumns: { ticker: string; book: ColumnBook | null; host: boolean; leaving: boolean }[] = [{ ticker: surface.ticker, book: { ticker: surface.ticker, snapshot, surface }, host: true, leaving: false }, ...columns];
  const tracks = Array.from({ length: TRACKS }, (_, i) => (i < allColumns.length && !allColumns[i].leaving ? '1fr' : '0fr')).join(' ');

  const body = (
    <div className="relative h-full min-h-0 flex flex-col">
      {head}
      {/* THE BOOK IS A DARK ISLAND on either theme — the calendar's capsules and the
          ladder's bars wear the heat ramp, cut for a dark ground (Noah, 2026-09-12:
          "these ladders need gray or black as the background") */}
      {/* ONE COLUMN PER NAME — the host's first, the names added beside it; all
          on the band's one set of choices, each with its own head (when there
          is more than one), its own read line and its own kept strike */}
      {/* PANES APART (Noah, 2026-09-12, on four ladders: "everything seems so
          compressed into each other… hard to distinguish where one ends and
          the other begins"): with names side by side the island turns to the
          canvas ground and every name stands as its own bordered panel with a
          gutter of ground between — the house's boxes, inside the box */}
      {/* FOUR TRACKS, ALWAYS: a name arriving is its track gliding 0fr → 1fr
          (the others narrowing to make room on the same glide), a name leaving
          is its track gliding shut with its panel fading — the grid is never
          re-laid at once. A cell clips its panel; the panel keeps a 4px margin
          inside the island's 4px padding, the 8px gutters of ground between. */}
      <div
        /* THE ISLAND IS PART OF THE PAGE ON PAPER (2026-09-22): the light theme's soft inset grey and the page's inks;
           the dark terminal keeps its black island to the digit */
        data-theme={paper ? 'light' : 'dark'}
        className={`relative flex-1 min-h-0 grid motion-reduce:transition-none ${many ? 'bg-canvas p-1' : paper ? 'bg-inset p-0' : 'bg-panel p-0'}`}
        style={{ gridTemplateColumns: tracks, transition: `grid-template-columns ${LEAVE_MS}ms ${EASE}, padding ${LEAVE_MS}ms ${EASE}, background-color ${LEAVE_MS}ms ${EASE}` }}
        data-field-island
        data-field-columns={1 + extraBooks.length}
      >
        {allColumns.map(c => {
          const kept = c.host ? selectedStrike : selectedStrikeFor?.(c.ticker) ?? null;
          const keep = c.host ? onSelectStrike : (s: number) => onSelectStrikeFor?.(c.ticker, s);
          /* the column's own greeks — the host's are the page's */
          const colPick = c.host ? pick : greeksOf(c.ticker);
          /* ONE GREEK PER NAME when names stand side by side (Noah, 2026-09-12) — the host's too:
             a multi pick made before a name arrived kept five greeks in a third of the band
             (2026-09-14), the widest way to empty the capsules */
          const colGreeks = c.host ? (many ? d.greeks.slice(0, 1) : d.greeks) : pickGreeks(colPick);
          const colGreek: Greek = c.host ? leadGreek : colGreeks[0] ?? 'gex';
          const read = readOf(c.ticker);
          /* the host's chip is the band's own, stepped down — in the own-name chip's
             clothes so the chips side by side look alike; a quote only while there
             is room for one */
          const chip = c.host ? (
            isValidElement(lead) ? cloneElement(lead as ReactElement<{ quote?: boolean; full?: boolean }>, { quote: !tight, full: !tight }) : lead
          ) : (
            <ScopeChip ticker={c.ticker} quote={!tight} onPick={sym => renameName(c.ticker, sym)} title={`${c.ticker} in this column · pick another name for it`} />
          );
          const removeDoor = !c.host && (
            <button
              type="button"
              onClick={() => removeName(c.ticker)}
              title={`Take ${c.ticker} off`}
              className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
              data-field-remove={c.ticker}
            >
              <X className="w-3 h-3" />
            </button>
          );
          const cell = (children: ReactNode) => (
            <div
              key={c.ticker}
              className="min-w-0 min-h-0 overflow-hidden flex flex-col motion-reduce:transition-none"
              style={{ opacity: c.leaving ? 0 : 1, transition: `opacity ${LEAVE_MS}ms ${EASE}` }}
              aria-hidden={c.leaving || undefined}
              data-field-cell={c.ticker}
              data-field-leaving={c.leaving || undefined}
            >
              <div
                className={`relative flex-1 min-h-0 flex flex-col ${paper ? 'bg-inset' : 'bg-panel'} rounded-md border overflow-hidden motion-reduce:transition-none ${many ? 'mx-1 border-borderSubtle' : 'mx-0 border-transparent'} ${c.host ? '' : 'animate-fade-in'}`}
                style={{ transition: `margin ${LEAVE_MS}ms ${EASE}, border-color ${LEAVE_MS}ms ${EASE}` }}
                data-field-column={c.ticker}
                data-field-host={c.host || undefined}
              >
                {children}
              </div>
            </div>
          );
          const book = c.book;
          if (!book)
            /* COLD — the column is open, the book on its way (its chip and its × already its own) */
            return cell(
              <>
                <Fold axis="y" open={many} className="shrink-0" testId="data-field-column-fold">
                  <div className="flex items-center gap-2 px-3 h-9 border-b border-borderSubtle/60 bg-ink/[0.03] font-mono min-w-0" data-field-column-head={c.ticker}>
                    <span className="shrink-0 inline-flex items-center">{chip}</span>
                    <span className="ml-auto text-[11px] text-textMuted truncate">Reading the book…</span>
                    {removeDoor}
                  </div>
                </Fold>
                <div className="flex-1 min-h-0 flex flex-col gap-[9px] px-3 py-3 animate-pulse" aria-hidden data-field-cold={c.ticker}>
                  {Array.from({ length: 40 }, (_, i) => (
                    <div key={i} className="h-[9px] rounded-full bg-ink/[0.06]" style={{ width: `${34 + 58 * (1 - Math.abs(i - 20) / 20)}%` }} />
                  ))}
                </div>
              </>
            );
          const sup = book.surface.supreme[colGreeks[0] ?? 'gex'];
          const supEx = book.surface.expiries[sup.e];
          return cell(
            <>
              {/* THE COLUMN'S HEAD unfolds when a second name arrives and folds
                  away with the last one taken off: the name's chip (the host's
                  follows the terminal, the others change in place), its
                  supreme, its one greek, its read's door, and × on the added */}
              <Fold axis="y" open={many} className="shrink-0" testId="data-field-column-fold">
                <div className="flex items-center gap-2 px-3 h-9 border-b border-borderSubtle/60 bg-ink/[0.03] font-mono min-w-0" data-field-column-head={c.ticker}>
                  <span className="shrink-0 inline-flex items-center">{chip}</span>
                  <button
                    type="button"
                    onClick={() => keep?.(sup.strike)}
                    title={`${c.ticker}'s heaviest strike of the whole book by ${GREEK_LABEL[colGreeks[0] ?? 'gex']} — most of it on ${supEx?.date ?? ''} · click to keep the strike`}
                    className="shrink-0 inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-supreme/40 bg-supreme/[0.06] hover:bg-supreme/[0.12] font-mono transition-colors"
                    data-column-supreme={sup.strike}
                  >
                    <span className="text-[11px] font-bold text-supreme">Supreme</span>
                    <span className="text-[11px] font-semibold tnum text-textPrimary whitespace-nowrap">
                      {fmtStrike(sup.strike)}
                      {!tight && (
                        <>
                          {' '}
                          <span className="text-textMuted font-normal">·</span> {fmtUsd(sup.total)}
                        </>
                      )}
                    </span>
                  </button>
                  {/* ONE GREEK PER NAME when names stand side by side (Noah,
                      2026-09-12: "only one should be allowed for the multiple
                      ticker choice") — a single choice, never the multi pick */}
                  <span className="ml-auto shrink-0 inline-flex items-center">
                    <DropdownSelect<string>
                      label="Greek"
                      value={colGreeks[0] ?? 'gex'}
                      options={SINGLE_GREEK_OPTIONS}
                      onChange={g => (c.host ? setPick([g]) : setGreeksOf(c.ticker, [g]))}
                      title={`What ${c.ticker}'s cells measure`}
                      testId={`ledger-greek-${c.ticker}`}
                      align="end"
                    />
                  </span>
                  <ReadDoor compact open={read === 'open'} onClick={() => toggleRead(c.ticker)} name={c.ticker} testId="data-column-read" />
                  {removeDoor}
                </div>
              </Fold>
              <div className="relative flex-1 min-h-0" data-ledger-body={c.ticker}>
                {/* the arriving view fades in — opacity only, the way a box of figures is allowed to */}
                {/* the shape on screen: out on the old, in on the new (the soft swap above) */}
                <div
                  key={drawn.key}
                  className={`h-full min-h-0 flex flex-col ${swapped ? 'animate-view-in' : ''}`}
                  style={{ opacity: fading ? 0 : 1, transition: `opacity ${SWAP_OUT_MS}ms ease-in` }}
                  data-ledger-view={d.view}
                  data-ledger-shape={drawn.key}
                  data-ledger-fading={fading || undefined}
                >
                  {d.view === 'matrix' ? (
                    <ExposureMatrix surface={book.surface} liveSpot={book.snapshot.spot} greeks={colGreeks} expiries={shownFor(book.surface, d)} rings={d.rings} hoverStrike={c.host ? hoverStrike : undefined} palette={palette} selectedStrike={kept} marks={c.host ? marks : undefined} onPointer={c.host ? onPointer : cellAt => pointedFor.current.get(c.ticker)?.(cellAt?.strike ?? null)} onSelectStrike={keep} lead={c.host ? leadGreek : undefined} />
                  ) : d.view === 'ladder' ? (
                    <ExposureLadder surface={book.surface} liveSpot={book.snapshot.spot} greeks={colGreeks} expiries={shownFor(book.surface, d)} rings={d.rings} hoverStrike={c.host ? hoverStrike : undefined} palette={palette} selectedStrike={kept} marks={c.host ? marks : undefined} onPointer={c.host ? onPointer : cellAt => pointedFor.current.get(c.ticker)?.(cellAt?.strike ?? null)} onSelectStrike={keep} lead={c.host ? leadGreek : undefined} onLead={c.host ? setLeadPick : undefined} />
                  ) : (
                    <ExposureLedger surface={book.surface} liveSpot={book.snapshot.spot} greeks={colGreeks} expiries={windowFor(book.surface, d)} rings={d.rings} hoverStrike={c.host ? hoverStrike : undefined} palette={palette} afterBell={d.afterBell} selectedStrike={kept} marks={c.host ? marks : undefined} onPointer={c.host ? onPointer : cellAt => pointedFor.current.get(c.ticker)?.(cellAt?.strike ?? null)} onSelectStrike={keep} fitKey={c.ticker} onFit={reportFit} paper={paper} />
                  )}
                </div>
                {/* THE READ — this name's, glass over the right of its own book
                    (the whole column when names are tight), in its lead greek */}
                {read && (
                  <BookRead
                    surface={book.surface}
                    snapshot={book.snapshot}
                    greek={colGreek}
                    mode={palette === 'thermal' ? 'thermal-yellow' : HEAT_MODE}
                    expiries={shownFor(book.surface, d)}
                    afterBell={d.afterBell}
                    rings={d.rings as StrikeWindow}
                    selectedStrike={kept}
                    fill={tight}
                    closing={read === 'closing'}
                    subscribePointed={c.host ? subscribePointed : subscribeFor(c.ticker)}
                    onKeep={keep}
                    onClose={() => closeRead(c.ticker)}
                  />
                )}
              </div>
            </>
          );
        })}
      </div>
      {/* THE GUIDE IN FOCUS — over the whole calendar, the grid blurred behind it */}
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the calendar" testId="ledger-guide">
        <LedgerGuide surface={surface} greek={supremeGreek} />
      </GuideFocus>
    </div>
  );

  /* THE SAME BOX, MOVED (the ruler's own, Compare.tsx): one motion.div wears
     the page's shape or the viewport's, and the layout animation glides it
     between the two — the head, the grid and the ladder never remount */
  if (fullMode === 'move') {
    return (
      <motion.div
        layout
        transition={{ layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
        /* THE GROUND IS THE PAGE'S when full (Noah, 2026-09-10: "the background
           becomes more ashy/gray when we full screen the ladder") — the box's
           panel grey over a whole screen read as a wash; the canvas black is
           what every other takeover stands on */
        className={full ? 'fixed inset-0 z-[80] bg-canvas flex flex-col' : 'relative h-full min-h-0 flex flex-col'}
        data-ledger-full={full || undefined}
      >
        <div className="flex-1 min-h-0 overflow-hidden">{body}</div>
      </motion.div>
    );
  }

  // Portal, not a plain fixed div: a transformed ancestor (the Pulse grid's
  // tiles) would become the containing block for position:fixed. Snug to
  // the edges — no frame, no padding.
  return full
    ? createPortal(
        <div
          className={`fixed inset-0 z-[80] bg-panel flex flex-col animate-takeover-in transition-opacity duration-[400ms] ease-in-out ${
            closing ? 'opacity-0' : ''
          }`}
          data-ledger-full
        >
          <div className="flex-1 min-h-0 overflow-hidden">{body}</div>
        </div>,
        document.body
      )
    : body;
};

export { GREEKS };
export default ExposureField;
