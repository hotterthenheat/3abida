/*
==================================================
  SLAYER TERMINAL - EVERYTHING IN IT
  (pages/landing/Everything.tsx)

  THE WHOLE TERMINAL, PAGE BY PAGE (2026-10-01 — the
  owner, of the landing: "you cant see all the features
  my website offers"). The tour walks the eight rooms
  one screen at a time; this is the list it leaves out:
  every page and tool in every room, each in one line,
  and EACH ONE A DOOR — a pick opens that page in the
  terminal.

  THE LIST IS THE TERMINAL'S OWN where the terminal
  keeps one: Pinpoint, Trace, Dossier and Practice read
  the registries their sub-bars, the palette and the
  page titles read (pages/<room>/subnav.ts), so a page
  added to a room is listed here the day it is built.
  The rooms without a registry (Pulse, Compass, Terrain,
  the Weigher) and what every room shares are written
  below, in the tour's own words where it has them.
  The glyphs stand bare — no box round a logo.

  THE LOOK keeps the page's grammar: rows on hairlines,
  not boxes. The rooms down the left, each on its glyph
  with its count; the picked room's pages in two columns
  on the right. On a phone the rooms are a row that
  scrolls sideways, and the pages one column under it.
  A room is a tab: arrows walk the rooms.

  THE ROOMS COME ROUND BY THEMSELVES (2026-10-02 — the
  owner: "each tab if they have more tabs to click it
  should automatically scroll to them so people can see
  everything without always having to use their mouse").
  While the list is on screen the lit room moves on to the
  next after a while — longer for a room with more pages —
  and a line on its tab fills meanwhile. A pointer or the
  keys inside the list hold it where it is; a room picked —
  or on a phone, a touch anywhere in the list — stays until
  the list leaves the screen. Not where less motion is
  asked for.
==================================================
*/

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useIsBelowLg } from '../../components/ui/useMediaQuery';
import ProductGlyph from '../../brand/ProductGlyph';
import type { GlyphName } from '../../brand/paths';
import { GEX_SUBPAGES } from '../pinpoint/subnav';
import { TRACE_SUBPAGES } from '../trace/subnav';
import { RECORD_SUBPAGES } from '../record/subnav';
import { PRACTICE_SUBPAGES } from '../practice/subnav';

export interface Feature {
  title: string;
  says: string;
  /** where it opens in the terminal; none for what lives on every page */
  path?: string;
}

export interface Room {
  id: string;
  name: string;
  glyph: GlyphName;
  /** the room in a few words — the tour's kind */
  kind: string;
  /** where "Open" takes the whole room */
  path?: string;
  features: Feature[];
}

const fromRegistry = (pages: { path: string; label: string; subtitle: string }[]): Feature[] => pages.map(p => ({ title: p.label, says: p.subtitle, path: p.path }));

/* THE ROOMS, in the tour's order. Pulse's twelve panels and four desks are pages/workspace/registry.tsx's and desks.ts's
   (not imported: they bring every panel's code with them) — counted there on 2026-10-01. */
export const ROOMS: Room[] = [
  {
    id: 'pulse',
    name: 'Pulse',
    glyph: 'pulse',
    kind: 'The desk',
    path: '/pulse',
    features: [
      { title: 'The desk', says: 'Live panels you add, drag and size, linked to one name or each on its own. It saves as you go.', path: '/pulse' },
      { title: 'Twelve panels', says: 'The chart, the strike ladder, the ledger, the range, where it closes, targets, the wall, where the walls are heading, setups, earnings, news and the Weigher.', path: '/pulse' },
      { title: 'Four desks to start from', says: 'Market Structure, The Day Ahead, Flow and 0DTE, or save one of your own.', path: '/pulse' },
      { title: 'Four charts', says: 'Four names at once, each with its own timeframe and overlays.', path: '/pulse/board' },
    ],
  },
  {
    id: 'compass',
    name: 'Compass',
    glyph: 'compass',
    kind: 'The contracts',
    path: '/compass',
    features: [
      { title: 'The board', says: 'Contracts picked off today’s levels, weeklies to LEAPS. Every card says where its setup stands — watch, active, moving or fading — and it changes as price moves.', path: '/compass' },
      { title: 'Inside the contract', says: 'Each card opens its setup on a live chart: four targets and a floor on the candles, with the premium ladder beside them.', path: '/compass' },
      { title: 'Tracker', says: 'What you kept, followed to the close.', path: '/compass/tracker' },
    ],
  },
  {
    id: 'terrain',
    name: 'Terrain',
    glyph: 'terrain',
    kind: 'The chart',
    path: '/terrain',
    features: [
      { title: 'One to four charts', says: 'Side by side, each with its own name, timeframe, overlays and indicators.', path: '/terrain' },
      { title: 'The strike rail', says: 'The book beside the chart, strike by strike.', path: '/terrain' },
      { title: 'Levels on the candles', says: 'The walls, the flip and the supreme, with one switch.', path: '/terrain' },
      { title: 'Linked charts', says: 'Charts that share a letter follow each other’s name.', path: '/terrain' },
      { title: 'Saved layouts', says: 'Name an arrangement and bring it back with one pick.', path: '/terrain' },
      { title: 'Your own scripts', says: 'Write an indicator in Pine and it draws on the chart.', path: '/terrain' },
      { title: 'Drawing tools', says: 'Lines, levels and notes that stay where you put them.', path: '/terrain' },
    ],
  },
  { id: 'pinpoint', name: 'Pinpoint', glyph: 'pinpoint', kind: 'The book', path: '/pinpoint/map', features: fromRegistry(GEX_SUBPAGES) },
  { id: 'trace', name: 'Trace', glyph: 'trace', kind: 'The tape', path: '/trace/live-tape', features: fromRegistry(TRACE_SUBPAGES) },
  {
    id: 'weigher',
    name: 'The Weigher',
    glyph: 'weigher',
    kind: 'The scale',
    path: '/weigher',
    features: [
      { title: 'The scanner', says: 'It finds the name; you pick the contract off the chain beside it.', path: '/weigher' },
      { title: 'The chain', says: 'Every strike and expiry for the name.', path: '/weigher' },
      { title: 'Positions and a watchlist', says: 'What you hold and what you watch, each row marked now, today and since it was added.', path: '/weigher' },
      { title: 'The position card', says: 'What a position would return at every price, on a ruler.', path: '/weigher' },
    ],
  },
  { id: 'dossier', name: 'Dossier', glyph: 'dossier', kind: 'The file on a name', path: '/dossier/news', features: fromRegistry(RECORD_SUBPAGES) },
  { id: 'practice', name: 'Practice', glyph: 'practice', kind: 'Paper trading and backtesting', path: '/practice/paper', features: fromRegistry(PRACTICE_SUBPAGES) },
  {
    id: 'every',
    name: 'In every room',
    glyph: 'terminal',
    kind: 'The small things',
    features: [
      { title: 'Alerts', says: 'Set one on any level, right where you are looking. It sounds on every page, and they all live in one drawer.', path: '/alerts' },
      /* WHAT IS TRUE, NOT WHAT SOUNDS WHOLE (2026-10-01 audit): "every page has a guide" — Pulse, the Tracker, Pinpoint's
         Board and Practice have none; "every page and every action has a key" — the keys are Ctrl K everywhere, Terrain's
         and the backtest's (Settings, KEY_GROUPS) */
      { title: 'How to read', says: 'Look for “How to read” on a page: a guide to what you are looking at, written in plain English. Trading terms stay. Buzzwords do not.' },
      { title: 'Kept as you left it', says: 'Layouts, names and colours are remembered. Open it tomorrow and it is the desk you closed.' },
      { title: 'The keyboard', says: 'Ctrl K, or ⌘K on a Mac, finds any name or page from anywhere. Terrain and the backtest answer to keys of their own, and one page lists every one.', path: '/settings/keyboard' },
      { title: 'Light and dark', says: 'Every page in both. Pick one in Settings, or let it follow your computer.', path: '/settings/appearance' },
    ],
  },
];

/** How many rooms, how many pages and tools in them, and how many things every room shares — the head says them, off the
    list itself */
const OWN = ROOMS.filter(r => r.id !== 'every');
export const ROOM_COUNT = OWN.length;
export const FEATURE_COUNT = OWN.reduce((n, r) => n + r.features.length, 0);
export const SHARED_COUNT = ROOMS.find(r => r.id === 'every')?.features.length ?? 0;

/** "Open the Weigher", not "Open The Weigher" */
export const doorName = (name: string) => name.replace(/^The /, 'the ');

/** how long a room stays lit before the next: a little more for a room with more pages, and brisk (the owner, 2026-10-02:
    "make the tab switching faster its so damn slow right now") */
const dwellOf = (r: Room) => Math.max(3200, Math.min(5200, 2200 + 220 * r.features.length));

const Everything = ({ onOpen }: { onOpen: (path: string) => void }) => {
  const [at, setAt] = useState(0);
  /* the rooms run in a row on a phone and a column from lg — the list says which, for a reader that hears it */
  const sideways = useIsBelowLg();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const room = ROOMS[at];
  const rooms = ROOMS.length;

  /* THE ROOMS COME ROUND: on screen, the tab in front, nobody's hand or keys in the list and no room picked */
  const root = useRef<HTMLDivElement | null>(null);
  const calm = useReducedMotion();
  const [seen, setSeen] = useState(false);
  const [front, setFront] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const [hand, setHand] = useState(false);
  const [keys, setKeys] = useState(false);
  const [picked, setPicked] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    const vis = () => setFront(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', vis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  /* a picked room stays until the list has left the screen */
  useEffect(() => {
    if (!seen) setPicked(false);
  }, [seen]);
  /* the rooms come round unless less motion is asked for or one was picked; they move while nothing holds them */
  const auto = !calm && !picked;
  const playing = auto && seen && front && !hand && !keys;
  /* the line on the lit tab, and the time its room has left: a new room has its whole while ahead; a hold keeps what is left */
  const bar = useRef<HTMLSpanElement | null>(null);
  const left = useRef(dwellOf(ROOMS[0]));
  useEffect(() => {
    left.current = dwellOf(ROOMS[at]);
  }, [at]);
  useEffect(() => {
    const el = bar.current;
    if (!playing) {
      /* held: the line stops where it is */
      if (el) {
        const t = getComputedStyle(el).transform;
        el.style.transition = 'none';
        el.style.transform = `scaleX(${t && t !== 'none' ? new DOMMatrix(t).a : 0})`;
      }
      return;
    }
    const t0 = performance.now();
    const ms = left.current;
    const raf = requestAnimationFrame(() => {
      if (!el) return;
      el.style.transition = `transform ${ms}ms linear`;
      el.style.transform = 'scaleX(1)';
    });
    const id = window.setTimeout(() => setAt(i => (i + 1) % rooms), ms);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(id);
      left.current = Math.max(400, ms - (performance.now() - t0));
    };
  }, [playing, at, rooms]);
  /* on a phone the rooms run in a row that scrolls sideways: the lit one is brought into it (the row moves, never the page) */
  const bring = useCallback((i: number, glide: boolean) => {
    const el = tabs.current[i];
    const row = el?.parentElement;
    if (el && row && row.scrollWidth > row.clientWidth) row.scrollTo({ left: Math.max(0, el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2), behavior: glide ? 'smooth' : 'auto' });
  }, []);
  useEffect(() => {
    if (playing) bring(at, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  /* a room is a tab: the arrows walk them, Home and End go to the ends */
  const key = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      let next = at;
      if (step) next = (at + step + rooms) % rooms;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = rooms - 1;
      else return;
      e.preventDefault();
      setAt(next);
      setPicked(true);
      tabs.current[next]?.focus();
      /* on a phone the row scrolls sideways: bring the room in without moving the page */
      bring(next, !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    },
    [at, rooms, bring]
  );

  return (
    <div
      ref={root}
      className="mt-12 lg:mt-14 grid grid-cols-1 lg:grid-cols-12 gap-x-12 xl:gap-x-16"
      onPointerEnter={e => e.pointerType === 'mouse' && setHand(true)}
      onPointerLeave={e => e.pointerType === 'mouse' && setHand(false)}
      /* a thumb has no hover to hold it with: a touch in the list keeps the room it is on until the list leaves the screen */
      onPointerDown={e => e.pointerType !== 'mouse' && setPicked(true)}
      /* the keys in the list hold it too (a Tab through its doors), until they leave it */
      onFocus={e => e.target.matches(':focus-visible') && setKeys(true)}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeys(false);
      }}
      data-landing-everything
      data-everything-playing={playing || undefined}
    >
      {/* THE ROOMS */}
      <div
        role="tablist"
        aria-label="Rooms"
        aria-orientation={sideways ? 'horizontal' : 'vertical'}
        className="lg:col-span-4 xl:col-span-3 landing-rooms -mx-4 px-4 sm:mx-0 sm:px-0 flex lg:flex-col gap-4 lg:gap-0 overflow-x-auto lg:overflow-visible max-lg:border-b max-lg:border-borderSubtle lg:border-t lg:border-borderSubtle"
      >
        {ROOMS.map((r, i) => {
          const on = i === at;
          return (
            <button
              key={r.id}
              ref={el => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${r.id}`}
              aria-selected={on}
              aria-controls={`${uid}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => {
                setAt(i);
                setPicked(true);
              }}
              onKeyDown={key}
              /* on a phone the rooms are words in a row, the lit one underlined in silver — no filled pill, no box round the
                 glyph (the owner, 2026-10-01: "i don't think these things should be white boxed") */
              className={`group relative shrink-0 flex items-center gap-2 lg:gap-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-silver
                max-lg:h-10 max-lg:px-1 max-lg:border-b-2
                lg:w-full lg:py-3 lg:pl-4 lg:pr-3 lg:border-b lg:border-borderSubtle ${
                  on
                    ? `${auto ? 'max-lg:border-silver/30' : 'max-lg:border-silver'} text-textPrimary lg:bg-ink/[0.04]`
                    : 'max-lg:border-transparent text-textSecondary hover:text-textPrimary lg:hover:bg-ink/[0.03]'
                }`}
              data-everything-room={r.id}
            >
              {/* silver is where you are, as in the tour's rows */}
              <span aria-hidden="true" className={`max-lg:hidden absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-full transition-colors ${on ? 'bg-silver' : 'bg-transparent'}`} />
              <ProductGlyph name={r.glyph} size={20} bare className="shrink-0" />
              <span className="min-w-0 flex-1 text-[14.5px] font-medium whitespace-nowrap">{r.name}</span>
              <span className={`max-lg:hidden text-[12px] tnum ${on ? 'text-textSecondary' : 'text-textMuted'}`}>{r.features.length}</span>
              {/* the lit room's while: the line fills, and the next room comes round when it is full */}
              {on && auto && (
                <span
                  ref={bar}
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[2px] lg:-bottom-px h-[2px] origin-left bg-silver"
                  style={{ transform: 'scaleX(0)' }}
                  data-everything-progress
                />
              )}
            </button>
          );
        })}
      </div>

      {/* THE PICKED ROOM'S PAGES */}
      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${room.id}`} className="lg:col-span-8 xl:col-span-9 mt-8 lg:mt-0" data-everything-panel={room.id}>
        <div key={room.id} className="animate-fade-in">
          <div className="flex items-end justify-between gap-6 pb-5 border-b border-borderSubtle">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-textMuted">{room.kind}</p>
              <h3 className="mt-2 text-[26px] sm:text-[30px] font-light tracking-[-0.03em] leading-tight">
                {room.name} <span className="text-textMuted tnum">· {room.features.length}</span>
              </h3>
            </div>
            {room.path && (
              <button
                type="button"
                onClick={() => onOpen(room.path!)}
                className="group/door shrink-0 inline-flex items-center gap-2 h-10 pl-4 pr-3.5 rounded-full border border-borderMuted text-[13.5px] font-medium text-textPrimary hover:border-textPrimary/70 hover:bg-ink/[0.06] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver"
                data-everything-door={room.id}
              >
                Open {doorName(room.name)}
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/door:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/door:translate-x-0" aria-hidden="true" />
              </button>
            )}
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
            {room.features.map(f => (
              <li key={f.title} className="border-b border-borderSubtle">
                {f.path ? (
                  <button
                    type="button"
                    onClick={() => onOpen(f.path!)}
                    className="group relative w-full h-full flex flex-col items-start justify-start text-left py-4 pr-16 transition-colors hover:bg-ink/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-silver"
                    data-everything-page={f.path}
                  >
                    <span className="block text-[15px] font-medium text-textPrimary">{f.title}</span>
                    <span className="mt-1 block text-[13.5px] leading-snug text-textSecondary">{f.says}</span>
                    <span aria-hidden="true" className="absolute right-1 top-4 inline-flex items-center gap-1 text-[12px] text-textMuted group-hover:text-textPrimary transition-colors">
                      Open
                      <ArrowRight className="w-3 h-3 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 motion-reduce:transition-none" />
                    </span>
                  </button>
                ) : (
                  <div className="py-4 pr-16">
                    <span className="block text-[15px] font-medium text-textPrimary">{f.title}</span>
                    <span className="mt-1 block text-[13.5px] leading-snug text-textSecondary">{f.says}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/* ONE TERMINAL, IN PLACE OF… — what a trader would otherwise keep open beside it, each on the glyph of the room that does
   it. Kinds of tool, never anybody's product. */
export const IN_PLACE_OF: { glyph: GlyphName; text: string; room: string }[] = [
  { glyph: 'trace', text: 'a flow feed', room: 'Trace' },
  { glyph: 'pinpoint', text: 'an exposure map', room: 'Pinpoint' },
  { glyph: 'terrain', text: 'a charting subscription', room: 'Terrain' },
  { glyph: 'trace', text: 'an options screener', room: 'Trace' },
  { glyph: 'paper', text: 'a paper-trading account', room: 'Practice' },
  { glyph: 'backtest', text: 'an options backtester', room: 'Practice' },
  { glyph: 'journal', text: 'a trading journal', room: 'Practice' },
  { glyph: 'dossier', text: 'an earnings calendar', room: 'Dossier' },
  { glyph: 'dossier', text: 'an insider and Congress tracker', room: 'Dossier' },
];

export const InPlaceOf = () => (
  <div className="mt-14 lg:mt-16 flex flex-col lg:flex-row lg:items-start gap-x-8 gap-y-4" data-landing-in-place-of>
    <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.22em] text-textMuted lg:pt-[11px]">One terminal, in place of</p>
    <ul className="flex flex-wrap gap-2">
      {IN_PLACE_OF.map(t => (
        <li key={t.text} title={`${t.room} does this`} className="h-9 pl-2 pr-3.5 inline-flex items-center gap-2 rounded-full border border-borderSubtle text-[13.5px] text-textSecondary">
          <ProductGlyph name={t.glyph} size={14} bare />
          {t.text}
        </li>
      ))}
    </ul>
  </div>
);

export default Everything;
