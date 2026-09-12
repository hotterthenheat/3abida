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

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import DropdownMulti from '../ui/DropdownMulti';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import LedgerGuide from './LedgerGuide';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import BookRead, { ReadDoor } from './BookRead';
import ExposureLedger from './ExposureLedger';
import ExposureLadder from './ExposureLadder';
import { GREEK_PICK_OPTIONS, nextGreekPick, pickGreeks, type SurfaceCell } from './exposureView';
import CompanyLogo from '../ui/CompanyLogo';
import TickerSearch from '../ui/TickerSearch';
import { useFadeClose } from '../ui/useFadeClose';
import { fmtUsd } from '../../data/gex';
import { STRIKE_WINDOWS, type StrikeWindow } from '../../data/exposure';
import { buildExposureSurface, CALENDAR_DTES, GREEKS, type ExposureSurface, type Greek } from '../../data/exposureSurface';
import { HEAT_MODE } from './heatmap';
import type { MarketSnapshot } from '../../types/market';

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
}

/** The whole book — every window is a view of it */
const WHOLE_BOOK: StrikeWindow = 30;
/** The Ledger's windows — never tighter than ±20 (Noah, 2026-09-05: "strike to each
    node should change with the minimum being 20 no 10's or 15's"); the host's own
    ±10/±15 control is the ladder's, not the grid's */
const LEDGER_WINDOWS: StrikeWindow[] = STRIKE_WINDOWS.filter(w => w >= 20);
const LEDGER_MIN: StrikeWindow = 20;
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
/** How far along the calendar to read — the columns shown */
const DEPTH_STEPS = [1, 3, 5, 8, 12, 99];
const PALETTE_OPTIONS: DropdownOption<'thermal' | 'house'>[] = [
  { value: 'thermal', label: 'Thermal', hint: 'Yellow in the middle, red where hedging amplifies a move, blue where it absorbs one' },
  { value: 'house', label: 'House', hint: 'Gold where hedging amplifies, ice where it absorbs' },
];
/* THE VIEW (Noah, 2026-09-10, his partner's "inventory & sensitivity by
   strike": "the net, put, call ratios with the bar for each section looks
   good. make a new button that allows for either the heatmap or this") —
   the same book two ways: the calendar's capsules by strike and expiry, or
   one row per strike with the put and call legs, the net and a bar. */
type LedgerView = 'calendar' | 'ladder';
const VIEW_OPTIONS: DropdownOption<LedgerView>[] = [
  { value: 'calendar', label: 'Calendar', hint: 'Strike by expiry — every cell a capsule' },
  { value: 'ladder', label: 'Ladder', hint: 'One row per strike — the put leg, the call leg, the net, and a bar' },
];
const SHOW_OPTIONS: DropdownOption<'now' | 'after'>[] = [
  { value: 'now', label: 'Now', hint: 'The calendar as it stands' },
  { value: 'after', label: 'After the close', hint: "The same calendar once today's contracts have expired" },
];

const ExposureField = ({ snapshot, half: halfProp, hoverStrike, selectedStrike, onHoverStrike, onSelectStrike, openRatio, onTicker, toolbar = 'desk', marks, lead, greeks: greeksProp, onGreeks, fresh = false, after, fullMode = 'portal', fullOpen, headFull = false }: ExposureFieldProps) => {
  const [ownPick, setOwnPick] = useState<string[]>(['gex']);
  const pick = greeksProp ?? ownPick;
  const setPick = (next: string[]) => {
    const settled = nextGreekPick(pick, next);
    setOwnPick(settled);
    onGreeks?.(settled);
  };
  /* The greeks drawn — a stable array per pick, so the grid and the ladder memo on it */
  const greeks = useMemo(() => pickGreeks(pick), [pick]);
  const [depth, setDepth] = useState<number>(8);
  /* BOOK AFTER THE BELL (the roadmap's band 3, 2026-09-05): today's column
     taken out — the book as it stands at the next open. The ledger says how
     much of the book that is. */
  const [afterBell, setAfterBell] = useState(false);
  /* THE PALETTE, a try (Noah, 2026-09-05: "can we try the thermal design
     just for a try") — the thermal leads while it is on trial; the house
     ramp is one click away. Only this grid reads it. */
  const [palette, setPalette] = useState<'house' | 'thermal'>('thermal');
  /* THE VIEW — the calendar, or the ladder (one row per strike); remembered */
  const [view, setView] = useState<LedgerView>(() => {
    try {
      return localStorage.getItem('slayer_ledger_view') === 'ladder' ? 'ladder' : 'calendar';
    } catch {
      return 'calendar';
    }
  });
  const pickView = (v: LedgerView) => {
    setView(v);
    try {
      localStorage.setItem('slayer_ledger_view', v);
    } catch {
      /* non-fatal */
    }
  };
  /* THE WINDOW: strikes each side of spot — the grid's own presets, never
     tighter than ±20; a host's tighter control only widens to the floor. */
  const seed = Math.max(LEDGER_MIN, halfProp ?? LEDGER_MIN);
  const [rings, setRings] = useState<number>(seed);
  useEffect(() => setRings(seed), [seed]);
  /* THE GUIDE AS A FOCUS (Noah, 2026-09-06, after the Map's: "i love this,
     keep it in the design pattern style. i think the heatmap needs one as
     well"): the card centred over the calendar, the grid blurred behind it;
     Esc (captured, so fullscreen stays) or a click on the blur lets go. */
  const [guideOpen, setGuideOpen] = useState(false);
  /* THE READ (2026-09-12, BookRead.tsx): the book's read as a glass card over
     the right of the ladder or the calendar. The pointer's strike goes to it
     through a ref — only the card re-renders on a move, never the grid. */
  const [readOpen, setReadOpen] = useState(false);
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
  const supremeGreek: Greek = greeks[0] ?? 'gex';
  if (!snapshot || !surface) {
    return (
      <div className="h-full min-h-[300px] grid place-items-center font-mono text-[11px] text-textMuted uppercase tracking-widest">
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
  const shownDepth = Math.min(depth, surface.expiries.length);

  /* The expiry choices, spelled as the dates on this calendar */
  const ex = surface.expiries;
  const depthOptions: DropdownOption<number>[] = DEPTH_STEPS.filter(n => n === 1 || n === 99 || n < ex.length).map(n => {
    if (n === 1) return { value: 1, label: 'Today only', hint: `${ex[0]?.date ?? 'Today'} — the contracts that expire at the bell` };
    if (n === 99) return { value: 99, label: 'Every expiry', hint: `${ex.length} expiries, through ${ex[ex.length - 1]?.date ?? ''}` };
    return { value: n, label: `Through ${ex[n - 1]?.date ?? ''}`, hint: `${n} expiries, today first` };
  });
  const depthValue = depthOptions.some(o => o.value === depth) ? depth : depth >= ex.length ? 99 : 1;
  const strips = (
    <>
      <DropdownSelect label="View" value={view} options={VIEW_OPTIONS} onChange={pickView} title="The calendar, or one row per strike" testId="ledger-view" />
      <DropdownMulti label="Greek" values={pick} groups={GREEK_GROUPS} onChange={setPick} emptyWord="All" title="One, some, or all five" testId="ledger-greek" align="start" />
      <DropdownSelect label="Expiries" value={depthValue} options={depthOptions} onChange={setDepth} title="How far along the calendar" testId="ledger-expiries" />
      <DropdownSelect
        label="Strikes"
        value={rings}
        options={LEDGER_WINDOWS.map(w => ({ value: w as number, label: `${w} each side`, hint: `${w} strikes above spot and ${w} below` }))}
        onChange={setRings}
        title="How many strikes around spot"
        testId="ledger-strikes"
      />
      <DropdownSelect label="Show" value={afterBell ? 'after' : 'now'} options={SHOW_OPTIONS} onChange={v => setAfterBell(v === 'after')} title="Which calendar" testId="ledger-show" />
      <DropdownSelect label="Colours" value={palette} options={PALETTE_OPTIONS} onChange={setPalette} title="What the colours mean" testId="ledger-colours" />
    </>
  );
  const supremeDoor = (
    <button
      onClick={() => onSelectStrike?.(supreme.strike)}
      title={`The heaviest strike of the whole book by ${GREEK_LABEL[supremeGreek]} — the one the chart wears in magenta — most of it on ${supremeEx?.date ?? ''} · click to pin the strike`}
      className="ml-auto inline-flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-supreme/40 bg-supreme/[0.06] hover:bg-supreme/[0.12] font-mono transition-colors"
    >
      <span className="text-[9px] font-bold uppercase tracking-widest text-supreme">Supreme</span>
      <span className="text-[12px] font-semibold tnum text-textPrimary whitespace-nowrap">
        {fmtStrike(supreme.strike)} <span className="text-textMuted font-normal">·</span> {supremeEx?.date ?? ''} <span className="text-textMuted font-normal">·</span> {fmtUsd(supreme.total)}
      </span>
    </button>
  );
  const guideButton = <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the grid means" testId="ledger-guide" />;
  /* THE READ's door — beside the guide's; lit while the card is up */
  const readDoor = <ReadDoor open={readOpen} onClick={() => setReadOpen(v => !v)} />;
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
      className="group inline-flex items-center gap-1.5 border border-borderSubtle hover:border-borderMuted rounded-md px-2.5 py-1 font-mono text-[10px] text-textSecondary hover:text-textPrimary transition-colors"
    >
      <ArrowLeft className="w-3 h-3 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" /> Back
    </button>
  ) : null;

  /* THE BAND HEAD — one row, the Map's toolbar grammar: the host names the book */
  const head = toolbar === 'band' ? (
    <div className="shrink-0 flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-1.5 border-b border-borderSubtle/60 bg-panel" data-ledger-toolbar>
      {backButton}
      {lead && <span className="shrink-0 inline-flex items-center">{lead}</span>}
      {strips}
      {after}
      {supremeDoor}
      {readDoor}
      {guideButton}
      {fullButton}
    </div>
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

  const body = (
    <div className="relative h-full min-h-0 flex flex-col">
      {head}
      {/* THE BOOK IS A DARK ISLAND on either theme — the calendar's capsules and the
          ladder's bars wear the heat ramp, cut for a dark ground (Noah, 2026-09-12:
          "these ladders need gray or black as the background") */}
      <div data-theme="dark" className="relative flex-1 min-h-0 bg-panel" data-field-island>
        {view === 'ladder' ? (
          <ExposureLadder surface={surface} liveSpot={snapshot.spot} greeks={greeks} depth={shownDepth} rings={rings} hoverStrike={hoverStrike} palette={palette} afterBell={afterBell} selectedStrike={selectedStrike} marks={marks} onPointer={onPointer} onSelectStrike={onSelectStrike} lead={leadGreek} onLead={setLeadPick} />
        ) : (
          <ExposureLedger surface={surface} liveSpot={snapshot.spot} greeks={greeks} depth={shownDepth} rings={rings} hoverStrike={hoverStrike} palette={palette} afterBell={afterBell} selectedStrike={selectedStrike} marks={marks} onPointer={onPointer} onSelectStrike={onSelectStrike} />
        )}
        {/* THE READ — glass over the right of the book, in the ladder's lead greek */}
        {readOpen && (
          <BookRead
            surface={surface}
            snapshot={snapshot}
            greek={leadGreek}
            mode={palette === 'thermal' ? 'thermal-yellow' : HEAT_MODE}
            depth={shownDepth}
            afterBell={afterBell}
            rings={rings as StrikeWindow}
            selectedStrike={selectedStrike}
            subscribePointed={subscribePointed}
            onKeep={onSelectStrike}
            onClose={() => setReadOpen(false)}
          />
        )}
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
