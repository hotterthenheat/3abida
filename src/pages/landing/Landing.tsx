/*
==================================================
  SLAYER TERMINAL - LANDING (/) · v5

  WORDS FIRST, THEN THE TERMINAL (2026-10-05 — the owner, of the landing of 2026-10-01 at 15:22: "i think this one idea
  wise is one of the better designs we had but it still lacks the wow factor … we need to have a nice strong quote and
  our holographic silver accent needs to be bit stronger in light and dark mode and used slightly more and then we
  shouldn't show any panels when u first land it should just be informational that teases and ropes you in and as you
  scroll you know you have amazing motions and small glitchy effects very subtle and then you get all the information").

  THE ORDER, ONE MOMENT A SECTION:
    The quote        the first screen is words: "You can't trade what you can't see.", what lies scattered in three
                     lines, and the two doors. No picture (Opening.tsx).
    The answer       the scroll turns the quote into "Trade what you can see.", and a silver line opens into the
                     terminal, the picture resolving out of a fine grain — the page's one wow.
    The session      that terminal goes to stand beside one session on SPY, three moments read off it as it ran, the
                     scroll playing it between them (Session.tsx).
    The rooms        the desk splits into the terminal's eight rooms, dealt into a wall; then one room at a time, the
                     scroll walking through them, each playing its pages, and the ground turning to the other theme and
                     home again (Rooms.tsx).
    Trust            a read, never an instruction: what it does, what it never does, and what every number stands on.
    Pricing          three plans, who each is for, the one difference, and what one terminal stands in place of.
    Questions        the buyer's questions, then "Seen enough? Step inside."
    The footer       the art piece, as it is (SiteFooter — never touched here).
  A phone and less motion have the first screen still, the terminal under it, and the rooms as tabs.

  THE PICTURES ARE THE TERMINAL ITSELF (Noah, 2026-09-19: "i want the REAL thing from our website so it doesnt scream
  fake"): every window plays a film of the real page in use (scripts/make-landing-clips.mjs reads every `path` on this
  page), the session is the real desk run forward (scripts/make-landing-session.mjs). Nothing is drawn to look like the
  product.

  THE RULES IT KEEPS: no reviews, ratings, member counts, results or performance of any kind (we have none); no grade,
  score, win rate, signal, guaranteed, confluence or market intelligence; never "simulated", "demo", "fake", "preview"
  or "at launch"; "Sign up free" is the door (an account is free; there is no trial). No refunds is said kindly, in the
  questions. The prices are data/billing.ts's; what each plan holds is PLAN_ROWS's. The foil is for display words and
  lines only, never body text.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Menu, Minus, Moon, Sun, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLANS, type PlanKey } from '../../data/billing';
import { COMPANY } from '../../data/company';
import { useLaunch } from '../../components/layout/LaunchTransition';
import SiteFooter from '../../components/layout/SiteFooter';
import { Block, GroundProvider, useBlockGround, useGround, type Ground } from './ground';
import TerminalWindow, { savingData, warmOtherGround } from './TerminalWindow';
import { warmShell } from '../../components/layout/shell';
import Session, { type Story as StoryHold } from './Session';
import Opening, { HOW_AT, Kicker, Quote, TRACK, Tease } from './Opening';
import Rooms, { type Room } from './Rooms';
import SlayerMark from '../../brand/SlayerMark';
import Wordmark from '../../brand/Wordmark';
import ProductGlyph from '../../brand/ProductGlyph';
import type { GlyphName } from '../../brand/paths';
import { unit, useLandingScale, useStacked, useUnit } from './scale';

/** Where "Launch terminal" opens the terminal: the desk an account lands on */
const DOOR = '/pulse';

/** THE BAR'S WORDS: this page's own sections */
const NAV: { label: string; href: string }[] = [
  { label: 'How it works', href: '#how' },
  { label: 'Rooms', href: '#rooms' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Questions', href: '#faq' },
];

/* THE TERMINAL UNDER THE FIRST SCREEN, where the scroll does not draw it (a phone, less motion): the desk an account lands
   on, in use (its film: scripts/make-landing-clips.mjs reads every `path` on this page) */
const HERO = {
  path: '/pulse',
};

/* THE ROOMS (Rooms.tsx). Every name, page and row here is a real one — the window opens it as the room comes. THE ORDER IS
   NOAH'S (2026-09-20): Pulse · Compass · Terrain · Pinpoint, the turn of the ground, then Trace · the Weigher · Dossier ·
   Practice. A row with a `path` is a page of its room, and is filmed (scripts/landing-stage.mjs); a row without one says
   what the room's page holds. Each room's pages come into the window along its own motion (Boot.tsx `sweep`). */
const ROOMS: Room[] = [
  {
    id: 'pulse',
    code: '01',
    glyph: 'pulse',
    kind: 'The desk',
    name: 'Pulse',
    lead: 'Your own desk of live panels.',
    rest: 'Add them, drag them, link them to one name or let each hold its own. It is kept the way you left it.',
    path: '/pulse',
    sweep: 'all',
    rows: [
      { title: 'The desk', says: 'The chart beside the hedging at every strike, the setups and the earnings under them.', path: '/pulse' },
      { title: 'Four charts', says: 'Four names at once, each with its own timeframe and overlays.', path: '/pulse/board' },
    ],
  },
  {
    id: 'compass',
    code: '02',
    glyph: 'compass',
    kind: 'The contracts',
    name: 'Compass',
    lead: 'Option contracts picked off today’s levels.',
    rest: 'Every card says where its setup stands — watch, active, moving or fading — and changes as price moves.',
    path: '/compass',
    sweep: 'deal',
    rows: [
      { title: 'The board', says: 'What cleared the bar on this sweep.', path: '/compass' },
      { title: 'Tracker', says: 'What you kept, followed to the close.', path: '/compass/tracker' },
    ],
  },
  {
    id: 'terrain',
    code: '03',
    glyph: 'terrain',
    kind: 'The chart',
    name: 'Terrain',
    lead: 'Charts, and nothing in the way.',
    rest: 'One to four side by side on one set of controls. The walls, the flip and the supreme go on the candles with one switch.',
    path: '/terrain',
    sweep: 'right',
    rows: [
      { title: 'The strike rail', says: 'The book beside the chart, strike by strike.' },
      { title: 'Your own scripts', says: 'Write an indicator in Pine and it draws on the chart.' },
      { title: 'Drawing tools', says: 'Lines, levels and notes that stay where you put them.' },
    ],
  },
  {
    id: 'pinpoint',
    code: '04',
    glyph: 'pinpoint',
    kind: 'The book',
    name: 'Pinpoint',
    lead: 'The whole book, by strike and by date.',
    rest: 'Where dealer hedging is heaviest, where it flips, and how each level has held today.',
    path: '/pinpoint/map',
    sweep: 'out',
    rows: [
      { title: 'The Map', says: 'Every strike and expiry, as a matrix or as a calendar.', path: '/pinpoint/map' },
      { title: 'Building', says: 'What was added to the book today, strike by strike.', path: '/pinpoint/building' },
      { title: 'At the wall', says: 'Does it hold or break, and what happens either way.', path: '/pinpoint/wall' },
      { title: 'Compare', says: 'Two names, side by side on one ruler.', path: '/pinpoint/compare' },
    ],
  },
  {
    id: 'trace',
    code: '05',
    glyph: 'trace',
    kind: 'The tape',
    name: 'Trace',
    lead: 'Every print, as it happens.',
    rest: 'Options sweeps and blocks, with the top bull, the top bear and the largest print named at the head of the tape.',
    path: '/trace/live-tape',
    sweep: 'down',
    rows: [
      { title: 'Live tape', says: 'The stream, newest first.', path: '/trace/live-tape' },
      { title: 'Net flow', says: 'Calls against puts, through the day.', path: '/trace/net-flow' },
      { title: 'Dark pool', says: 'Off-exchange crosses, largest first.', path: '/trace/dark-pool' },
      { title: 'Screener', says: 'Every contract, filtered your way.', path: '/trace/screener' },
    ],
  },
  {
    id: 'weigher',
    code: '06',
    glyph: 'weigher',
    kind: 'The scale',
    name: 'The Weigher',
    lead: 'Weigh any contract before you take it.',
    rest: 'The chart, the chain and your watchlist on one desk.',
    path: '/weigher',
    sweep: 'out',
    rows: [
      { title: 'The chain', says: 'Every strike and expiry for the name.' },
      { title: 'Positions and a watchlist', says: 'What you hold and what you watch, each row marked now, today and since it was added.' },
      { title: 'The position card', says: 'What a position would return at every price, on a ruler.' },
    ],
  },
  {
    id: 'dossier',
    code: '07',
    glyph: 'dossier',
    kind: 'The file on a name',
    name: 'Dossier',
    lead: 'Everything on file about a name.',
    rest: 'The news, the earnings, and what insiders and members of Congress filed.',
    path: '/dossier/news',
    sweep: 'down',
    rows: [
      { title: 'News', says: 'The wire, on a map.', path: '/dossier/news' },
      { title: 'Earnings', says: 'The calendar, and a page for each name.', path: '/dossier/earnings' },
      { title: 'Insiders', says: 'Who filed, what, and when.', path: '/dossier/insiders' },
      { title: 'Congress', says: 'Trades disclosed by members of Congress.', path: '/dossier/congress' },
      { title: 'Stocks', says: 'A plain read of any name: strong, good, caution or poor.', path: '/dossier/stocks' },
    ],
  },
  {
    id: 'practice',
    code: '08',
    glyph: 'practice',
    kind: 'Paper trading and backtesting',
    name: 'Practice',
    lead: 'Paper trade today’s prices, or replay a past day’s.',
    rest: 'Calls, puts and spreads with paper money, and nothing reaches a broker.',
    path: '/practice/paper',
    sweep: 'right',
    rows: [
      { title: 'Paper trading, live', says: 'A practice account or a prop firm’s evaluation on today’s prices.', path: '/practice/paper' },
      { title: 'Options, off the real chain', says: 'A past day played back, every contract as it was quoted that minute.', path: '/practice/backtest' },
      { title: 'The journal', says: 'Every closed trade on its chart, with your tags and your words.', path: '/practice/journal' },
    ],
  },
];

/** THE TURN'S TWO LINES — each said on the ground it names (Rooms.tsx) */
const TURN_SAYS: Record<Ground, string> = { dark: 'Dark for the night session.', light: 'Paper for a bright room.' };

/** the rooms counted off the list itself, so the words cannot disagree with it */
const ROOM_COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][ROOMS.length] ?? String(ROOMS.length);

/* A READ, NEVER AN INSTRUCTION — every line true of the terminal today */
const IT_DOES = [
  'Shows where dealer hedging sits, and redraws it as the day moves',
  'Reads a contract against that and says it in a word: strong, good, caution or poor',
  'Keeps a setup current: watch while it forms, active while it holds, fading when it breaks',
  'Explains its reads in plain English',
];
const IT_NEVER = ['Tells you what to buy or sell', 'Places an order. It is not a broker', 'Boils a trade down to one number', 'Gives financial advice'];

/* WHAT IT PRODUCES, NEVER HOW (the brief of 2026-10-03: "Recipe stays private. Result is visible" — no formula, weighting,
   threshold or assumption that would let the engine be rebuilt). The kinds are /legal/data's, in three. */
const KINDS: { name: string; says: string; items: string[] }[] = [
  {
    name: 'Observed',
    says: 'What the market printed.',
    items: ['Trades and quotes', 'Every options print, its size and its side', 'Open interest and volume', 'Filings and the news'],
  },
  {
    name: 'Calculated',
    says: 'Worked out from what was observed, by fixed rules.',
    items: ['The exposure at every strike', 'Net premium and flow through the day', 'The walls, the flip and the heaviest strike', 'How each level has held today'],
  },
  {
    name: 'Modeled',
    says: 'Where an assumption is needed — and named as one.',
    items: ['Which side of a trade dealers are on', 'The expected move into an expiry', 'A contract’s fair value'],
  },
];

/* WHAT EACH PLAN HOLDS — one list (the plans side by side read it whole). A line marked `soon` is sold with the plan but
   not open yet, and says so: Community is behind the terminal's "coming soon" wall. Re-deciding a plan is changing its
   letters here. */
type Holds = boolean | 'soon';
interface PlanRow {
  text: string;
  glyph?: GlyphName;
  in: Record<PlanKey, Holds>;
}
const PLAN_ROWS: PlanRow[] = [
  { text: 'Pulse, your desk of live panels', glyph: 'pulse', in: { pinpoint: true, compass: true, lifetime: true } },
  { text: 'Terrain, the levels on the chart and your own scripts', glyph: 'terrain', in: { pinpoint: true, compass: true, lifetime: true } },
  { text: 'Pinpoint, the book by strike and by date', glyph: 'pinpoint', in: { pinpoint: true, compass: true, lifetime: true } },
  { text: 'Trace, the tape and the dark pool', glyph: 'trace', in: { pinpoint: true, compass: true, lifetime: true } },
  { text: 'Alerts on any level', glyph: 'alerts', in: { pinpoint: true, compass: true, lifetime: true } },
  { text: 'Compass, contracts that fit the levels', glyph: 'compass', in: { pinpoint: false, compass: true, lifetime: true } },
  { text: 'The Weigher, for any contract you name', glyph: 'weigher', in: { pinpoint: false, compass: true, lifetime: true } },
  { text: 'Dossier: news, earnings, insiders, Congress, stocks', glyph: 'dossier', in: { pinpoint: false, compass: true, lifetime: true } },
  { text: 'Practice: paper trading, backtesting and the journal', glyph: 'practice', in: { pinpoint: false, compass: true, lifetime: true } },
  { text: "Community, the traders' room", glyph: 'community', in: { pinpoint: false, compass: 'soon', lifetime: 'soon' } },
  { text: 'One payment, nothing recurring', in: { pinpoint: false, compass: false, lifetime: true } },
  { text: 'A one-to-one session to set up your desk', in: { pinpoint: false, compass: false, lifetime: true } },
  { text: 'New tools before anyone else', in: { pinpoint: false, compass: false, lifetime: true } },
];
const PLAN_ORDER: PlanKey[] = ['pinpoint', 'compass', 'lifetime'];

/* EACH PLAN, IN TWO LINES (the brief: "Plan, Price, Who it's for, Main difference, CTA") — who it is for, said from the
   trader's side, and the one thing it holds that the one before does not */
const PLAN_FOR: Record<PlanKey, string> = {
  pinpoint: 'Traders who read the levels and the tape and make their own calls.',
  compass: 'Traders who also want contracts picked off the levels, and room to practise.',
  lifetime: 'Traders who want all of it, for good.',
};
const PLAN_HOLDS: Record<PlanKey, string> = {
  pinpoint: 'Pulse, Terrain, Pinpoint, Trace and alerts.',
  compass: 'Everything in Pinpoint, plus Compass, the Weigher, Dossier and Practice.',
  lifetime: 'Every desk, paid once, with a one-to-one session to set up your desk.',
};
const PLAN_GLYPH: Record<PlanKey, GlyphName | null> = { pinpoint: 'pinpoint', compass: 'compass', lifetime: null };

/* ONE TERMINAL, IN PLACE OF… — what a trader would otherwise keep open beside it, each on the glyph of the room that does
   it. Kinds of tool, never anybody's product. */
const IN_PLACE_OF: { glyph: GlyphName; text: string; room: string }[] = [
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

/* THE QUESTIONS A BUYER ASKS (kept to purchase objections — not product documentation). No refunds, said kindly, here and
   never as a banner. */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is Slayer Terminal?',
    a: 'A terminal for trading US stocks and options. It puts where options positions sit, the levels they make, what is trading right now and what was filed on one screen, and keeps it current as the session moves.',
  },
  {
    q: 'Who is it for?',
    a: 'Traders who make their own decisions and want to see the market’s structure before they do — day traders, swing traders and anyone trading options on US names.',
  },
  { q: 'What markets are supported?', a: 'US-listed stocks and ETFs and their options, and the SPX, NDX and RUT indexes. Paper trading is options only.' },
  {
    q: 'Where does the data come from?',
    a: 'From the market’s own record: trades and quotes for US stocks and options, open interest as the exchanges publish it, and public filings. The Data page lists what every number stands on.',
  },
  {
    q: 'Is the data real-time?',
    a: 'Prices, quotes and options prints update as they trade, through market hours. Open interest is published once a day, before the open, so what is built on it updates then.',
  },
  {
    q: 'What does each room do?',
    a: 'Pulse is your desk of live panels. Compass picks contracts that fit today’s levels. Terrain draws positioning on the chart. Pinpoint shows where it concentrates and where hedging flips. Trace follows every print as it crosses. The Weigher weighs any contract, Dossier keeps the file on a name, and Practice trades with paper money.',
  },
  {
    q: 'What is included in each plan?',
    a: 'Pinpoint holds Pulse, Terrain, Pinpoint, Trace and alerts. Compass adds Compass, the Weigher, Dossier and Practice. Lifetime is all of it, for good. The full list is under the plans.',
  },
  { q: 'Can I cancel?', a: 'Yes, any time in Settings. Your plan runs to the end of the period you paid for.' },
  {
    q: 'Are there refunds?',
    a: 'We don’t offer refunds. Making an account is free, so look around before you pay. If a charge ever looks wrong, write to billing@slayerterminal.com and a person will look into it.',
  },
  { q: 'Does Slayer place trades?', a: 'No. Slayer is not a broker and never places an order. Practice trades with paper money, and nothing in it reaches a broker.' },
  { q: 'Is Slayer financial advice?', a: 'No. Slayer shows the market and how it is positioned; it never tells you what to buy or sell. Every decision is yours.' },
];

/* ---- the pieces ---------------------------------------------------------------------------- */

const Wrap = ({ children, className = '', ...rest }: { children: ReactNode; className?: string } & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>) => (
  <div {...rest} className={`mx-auto w-full max-w-[var(--landing-col)] px-4 sm:px-6 lg:px-10 ${className}`}>
    {children}
  </div>
);

/** ONE SMALL WORD OVER A SHORT BAR — above every head on the page, the Logo System's section label; the bar is the foil
    (v5: the silver, used a little more) */
const Eyebrow = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col items-start gap-2.5">
    <p className="text-[0.8125rem] text-textMuted">{children}</p>
    <span className="foil-fill w-10 h-[0.1875rem] rounded-full" aria-hidden="true" />
  </div>
);

/** EVERY HEAD IS TWO LINES IN TWO TONES: what it is in ink, the turn of the thought in grey */
const TwoTone = ({ first, second, className = '' }: { first: string; second: string; className?: string }) => (
  /* outline-none: a jump along the page lands the keys here (toAnchor) — a heading to land on, not a control */
  <h2 className={`font-light tracking-[-0.04em] leading-[1.02] text-[2rem] sm:text-[2.625rem] lg:text-[3.125rem] [text-wrap:balance] outline-none ${className}`}>
    {first} <span className="block text-textMuted">{second}</span>
  </h2>
);

/** ONE ARRIVAL, ONCE: a block that comes in as it is first seen — a line reveal for words (the Logo System's text reveal:
    line by line, 40 ms apart). Nothing where less motion is asked for, and nothing hidden before the script has run (the
    waiting state is set by it). */
const useArrival = <T extends HTMLElement>(margin = '0px 0px -18% 0px') => {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.82) return;
    el.dataset.arrival = 'wait';
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.dataset.arrival = 'in';
        io.disconnect();
      },
      { rootMargin: margin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return ref;
};

/** A SECTION'S HEAD: its word over a bar, its two-tone line and, beside it, a line of what follows — arriving a line at a
    time as it is first seen, the two-tone line coming into focus (index.css .landing-settle) */
const Head = ({ eyebrow, first, second, aside, id }: { eyebrow: string; first: string; second: string; aside?: ReactNode; id?: string }) => {
  const ref = useArrival<HTMLDivElement>();
  return (
    <div ref={ref} id={id} className="landing-lines grid grid-cols-1 lg:grid-cols-12 gap-x-16 gap-y-6 lg:items-end">
      <div className="lg:col-span-7">
        <div className="landing-line [--i:0]">
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <div className="landing-line landing-settle [--i:1]">
          <TwoTone className="mt-6" first={first} second={second} />
        </div>
      </div>
      {aside && <p className="landing-line [--i:2] lg:col-span-5 max-w-[30rem] text-[1rem] leading-relaxed text-textSecondary lg:pb-2">{aside}</p>}
    </div>
  );
};

/** THE FOIL'S WORD — the foil on either ground since v5 (the pale run on black, the deep run on paper: index.css
    --holo-ink) */
const Foil = ({ children }: { children: ReactNode }) => (
  /* the foil's letters get room past their box (the headline's tight tracking would cut the "e"'s overhang — 2026-09-20) */
  <span className="holo-text font-medium inline-block px-[0.06em] -mx-[0.06em]">{children}</span>
);
/* THE LAST WORDS, READ BY SCROLLING (2026-10-02, from the owner's notes on two landings that make a line's reading the
   scroll itself): each letter of the closing lines stands faint and turns to its own ink, one letter at a time, as the
   lines come up the screen — the scroll is the playhead, and scrolling back takes them back. A reader that hears the page
   hears the lines whole (the label); where less motion is asked for, they stand lit. Only the letters that change are
   touched, and only while the lines are near the screen. A stepped scroll that comes to rest with them on screen lights
   the rest of them. */
const LitLines = ({ lines, className = '' }: { lines: { text: string; ink: string }[]; className?: string }) => {
  const ref = useRef<HTMLHeadingElement | null>(null);
  const calm = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || calm) return;
    const letters = Array.from(el.querySelectorAll<HTMLElement>('[data-letter]'));
    let lit = -1;
    let raf = 0;
    let floor = 0;
    let rest = 0;
    let undo = 0;
    const show = (n: number) => {
      if (n === lit) return;
      const from = lit < 0 ? 0 : Math.min(n, lit);
      const to = lit < 0 ? letters.length : Math.max(n, lit);
      for (let i = from; i < to; i++) letters[i].dataset.lit = i < n ? 'on' : 'off';
      lit = n;
    };
    const paint = () => {
      raf = 0;
      const top = el.getBoundingClientRect().top;
      const vh = window.innerHeight;
      if (top > vh * 0.95) floor = 0;
      const p = Math.max(0, Math.min(1, (vh * 0.95 - top) / (vh * 0.25)));
      show(Math.max(floor, Math.round(p * letters.length)));
    };
    const settle = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.top > vh * 0.9 || r.bottom < 0 || lit >= letters.length) return;
      const from = Math.max(0, lit);
      for (let i = from; i < letters.length; i++) letters[i].style.transitionDelay = `${(i - from) * 30}ms`;
      floor = letters.length;
      show(letters.length);
      window.clearTimeout(undo);
      undo = window.setTimeout(() => letters.forEach(l => (l.style.transitionDelay = '')), (letters.length - from) * 30 + 250);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(paint);
      window.clearTimeout(rest);
      rest = window.setTimeout(settle, 700);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          window.addEventListener('scroll', on, { passive: true });
          on();
        } else window.removeEventListener('scroll', on);
      },
      { rootMargin: '25% 0px' }
    );
    io.observe(el);
    paint();
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', on);
      cancelAnimationFrame(raf);
      window.clearTimeout(rest);
      window.clearTimeout(undo);
    };
  }, [calm]);
  return (
    <h2 ref={ref} aria-label={lines.map(l => l.text).join(' ')} className={className}>
      {lines.map((l, i) => (
        <span key={l.text} aria-hidden="true" className={i ? 'block' : ''}>
          {l.text.split(' ').map((word, w, words) => (
            <span key={w}>
              <span className="inline-block whitespace-nowrap">
                {Array.from(word).map((ch, c) => (
                  <span key={c} data-letter data-lit={calm ? 'on' : 'off'} className={`${l.ink} data-[lit=off]:text-textPrimary/[0.14] transition-colors duration-200 motion-reduce:transition-none`}>
                    {ch}
                  </span>
                ))}
              </span>
              {w < words.length - 1 && ' '}
            </span>
          ))}
          {i < lines.length - 1 && ' '}
        </span>
      ))}
    </h2>
  );
};

/** THE PILL (Slayer Logo System, Web and App): solid is the page's ink — the light pill on black, the black pill on paper —
    and a ghost is a hairline. UNDER THE POINTER THE FOIL ANSWERS (v5, 2026-10-05: the silver "used slightly more"): the
    solid takes the foil as its surface, sweeping across it; the ghost takes it as its edge (index.css .door-foil,
    .door-edge). NO GROWING UNDER THE POINTER (2026-09-20: "look laggy"); only a press gives. */
const Pill = ({ children, onClick, href, kind = 'solid', size = 'lg', testId }: { children: ReactNode; onClick?: () => void; href: string; kind?: 'solid' | 'ghost'; size?: 'lg' | 'sm'; testId?: string }) => {
  const fill = kind === 'solid' ? 'door-foil bg-textPrimary text-canvas' : 'door-edge border border-borderMuted text-textPrimary hover:border-transparent hover:bg-ink/[0.05]';
  return (
    <a
      href={href}
      onClick={e => {
        if (!onClick) return;
        e.preventDefault();
        onClick();
      }}
      data-landing-door={testId}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-[0.98] active:duration-100 motion-reduce:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-silver ${size === 'lg' ? 'h-12 px-7 text-[0.9375rem]' : 'h-9 px-4 text-[0.8125rem]'} ${fill}`}
    >
      {children}
    </a>
  );
};

/** A jump along the page glides — unless the visitor asked their system for less motion: then it is a cut */
const glideOrCut = (): ScrollBehavior => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/* A JUMP ALONG THE PAGE LEAVES A WAY BACK (2026-10-03 audit): the jump is a step in the history, and Back returns the
   reader to where they jumped from. AND IT TAKES THE KEYS WITH IT: the section's head takes the focus, quietly, so the next
   Tab goes on inside the section. A place inside a run the scroll plays (the session's first words, the wall of rooms) is
   a marker that names its head (`data-focus`). */
const toAnchor = (href: string) => {
  if (location.hash !== href) history.pushState(null, '', href);
  const to = document.querySelector<HTMLElement>(href);
  if (!to) return;
  to.scrollIntoView({ behavior: glideOrCut(), block: 'start' });
  const named = to.dataset.focus ? document.querySelector<HTMLElement>(to.dataset.focus) : null;
  const head = named ?? to.querySelector<HTMLElement>('h2') ?? to;
  if (!head.hasAttribute('tabindex')) head.setAttribute('tabindex', '-1');
  const land = () => {
    head.focus({ preventScroll: true });
    return document.activeElement === head;
  };
  if (land()) return;
  /* a head the scroll itself brings in (the session's first words come in as the opening hands its window over) cannot
     take the focus until it stands: it takes it once the glide is over and the page has drawn where it ended, asking
     again a few times while it comes in */
  let done = false;
  const late = () => {
    if (done) return;
    done = true;
    window.removeEventListener('scrollend', late);
    let tries = 12;
    const again = () => {
      if (land() || --tries <= 0) return;
      window.setTimeout(again, 150);
    };
    requestAnimationFrame(() => requestAnimationFrame(again));
  };
  window.addEventListener('scrollend', late, { once: true });
  window.setTimeout(late, 1800);
};

/** THE BAR. Flat across the top of the page with the wordmark; once the page moves it lifts into a floating pill and the
    wordmark gives way to the mark (the Logo System's own two frames). The pill is solid panel, not glass (the brief of
    2026-10-03: "No glassmorphism"). */
const Nav = ({ ground }: { ground: Ground }) => {
  const { choose } = useGround();
  /* the wordmark and the mark are drawn to a size in px: the landing's scale (scale.ts) */
  const u = useUnit();
  const { launch } = useLaunch();
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const [lifted, setLifted] = useState(false);
  useMotionValueEvent(scrollY, 'change', y => setLifted(y > 24));
  /* THE PHONE'S MENU: the page's own doors as a small sheet under the bar, rows on hairlines. It closes on a pick, on
     Escape (the keys go back to its button), on a tap outside it, and when the page scrolls on from under it. */
  const [menu, setMenu] = useState(false);
  const menuDoor = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const at = document.activeElement;
      if (at instanceof Element && at.closest('[data-landing-menu], [data-landing-menu-door]')) menuDoor.current?.focus();
      setMenu(false);
    };
    const moved = (e: FocusEvent) => {
      if (e.target instanceof Element && !e.target.closest('[data-landing-nav]')) setMenu(false);
    };
    /* a tap outside closes it, and only closes it: on a touch screen the tap went on to press what was under the finger */
    let swallow = 0;
    const eat = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const down = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('[data-landing-menu], [data-landing-menu-door]')) {
        setMenu(false);
        if (e.pointerType !== 'mouse' && e.target instanceof Element && !e.target.closest('header')) {
          document.addEventListener('click', eat, { capture: true, once: true });
          window.clearTimeout(swallow);
          swallow = window.setTimeout(() => document.removeEventListener('click', eat, { capture: true }), 600);
        }
      }
    };
    const from = window.scrollY;
    const scrolled = () => {
      if (Math.abs(window.scrollY - from) > 80) setMenu(false);
    };
    window.addEventListener('keydown', key);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('focusin', moved);
    window.addEventListener('scroll', scrolled, { passive: true });
    return () => {
      window.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('focusin', moved);
      window.removeEventListener('scroll', scrolled);
      window.clearTimeout(swallow);
    };
  }, [menu]);
  const glide = 'transition-[max-width,background-color,border-color,box-shadow,padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';
  /* "Holographic silver · in the S and on Launch terminal" — the foil as a surface on either ground (index.css .launch-pill) */
  const launchFill = 'launch-pill';
  return (
    <header data-theme={ground} className="fixed top-0 inset-x-0 z-40 flex justify-center px-3 sm:px-4 pt-2.5 sm:pt-3.5 pointer-events-none" data-landing-nav={ground} data-lifted={lifted || undefined}>
      <div
        className={`pointer-events-auto relative w-full h-[3.25rem] flex items-center gap-2 sm:gap-4 rounded-full border ${glide} ${
          lifted ? 'max-w-[47.5rem] pl-2.5 pr-1.5 border-borderSubtle bg-panel shadow-[0_1rem_3.125rem_-1.25rem_rgb(0_0_0/0.55)]' : 'max-w-[calc(var(--landing-col)_-_2rem)] pl-1 sm:pl-2 lg:pl-6 pr-0 sm:pr-1 lg:pr-5 border-transparent bg-transparent'
        }`}
      >
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: glideOrCut() })} className="shrink-0 inline-flex items-center select-none rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver" aria-label="Slayer Terminal, back to the top" data-landing-brand>
          {/* the wordmark on the open bar, the mark on the lifted pill and on a phone */}
          <span className={lifted ? 'hidden' : 'hidden sm:inline-flex'}>
            <Wordmark height={15 * u} cursor label="" />
          </span>
          <span className={lifted ? 'inline-flex' : 'sm:hidden inline-flex'}>
            <SlayerMark size={26 * u} bare near label="" />
          </span>
        </button>
        <nav className="hidden md:flex items-center gap-0.5 mx-auto" aria-label="On this page">
          {NAV.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={e => {
                e.preventDefault();
                toAnchor(l.href);
              }}
              className="h-8 px-3.5 inline-flex items-center rounded-full text-[0.84375rem] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver whitespace-nowrap"
            >
              {l.label}
            </a>
          ))}
        </nav>
        {/* THE TOGGLE NAMES WHAT IT DOES: it turns the page to the other theme, and keeps that for the whole site */}
        <button
          type="button"
          onClick={() => choose(ground === 'dark' ? 'light' : 'dark')}
          onPointerEnter={warmOtherGround}
          onFocus={warmOtherGround}
          className="ml-auto md:ml-0 h-9 w-9 inline-flex items-center justify-center rounded-full text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver"
          aria-label={ground === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
          title={ground === 'dark' ? 'Light theme' : 'Dark theme'}
          data-landing-theme={ground}
        >
          {ground === 'dark' ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => setMenu(m => !m)}
          className="md:hidden h-9 w-9 inline-flex items-center justify-center rounded-full text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver"
          ref={menuDoor}
          aria-label={menu ? 'Close the menu' : 'Menu'}
          aria-expanded={menu}
          aria-controls="landing-menu"
          data-landing-menu-door
        >
          {menu ? <X className="w-4 h-4" aria-hidden="true" /> : <Menu className="w-4 h-4" aria-hidden="true" />}
        </button>
        <a
          href={DOOR}
          onClick={e => {
            e.preventDefault();
            launch(DOOR);
          }}
          className={`h-10 px-4 sm:px-5 inline-flex items-center rounded-full text-[0.84375rem] font-medium whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver ${launchFill}`}
          data-landing-door="nav"
        >
          <span className="sm:hidden">Launch</span>
          <span className="hidden sm:inline">Launch terminal</span>
        </a>
      </div>
      <AnimatePresence>
        {menu && (
          <motion.nav
            id="landing-menu"
            aria-label="On this page"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden pointer-events-auto absolute top-[4.375rem] inset-x-3 max-h-[calc(100svh-5.625rem)] overflow-y-auto overscroll-contain rounded-3xl border border-borderSubtle bg-panel shadow-[0_1.5rem_3.75rem_-1.5rem_rgb(0_0_0/0.6)] px-5 pt-1"
            data-landing-menu
          >
            {NAV.map(l => (
              <a
                key={l.href}
                href={l.href}
                onClick={e => {
                  e.preventDefault();
                  setMenu(false);
                  toAnchor(l.href);
                }}
                className="flex items-center justify-between h-[3.25rem] border-b border-borderSubtle text-[1.0625rem] text-textPrimary"
              >
                {l.label}
                <ArrowRight className="w-4 h-4 text-textMuted" aria-hidden="true" />
              </a>
            ))}
            <div className="pt-3 pb-4">
              <a
                href="/signup"
                onClick={e => {
                  e.preventDefault();
                  setMenu(false);
                  navigate('/signup');
                }}
                className="h-12 flex items-center justify-center rounded-full text-[0.9375rem] font-medium bg-textPrimary text-panel"
                data-landing-door="menu"
              >
                Sign up free
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
};

/** THE CUE: the page goes on (a foil dot down a hairline, three times, then still) */
const Cue = ({ className = '' }: { className?: string }) => (
  <div aria-hidden="true" className={`landing-rise [--rise-delay:900ms] flex flex-col items-center gap-3 ${className}`}>
    <span className="text-[0.6875rem] uppercase tracking-[0.24em] text-textMuted">Scroll</span>
    <span className="relative block w-px h-9 overflow-hidden bg-ink/[0.14]">
      <span className="landing-cue absolute inset-x-0 top-0 h-1/3 foil-fill" />
    </span>
  </div>
);

/* THE FIRST SCREEN, STILL (a phone, less motion): the quote, what lies scattered, the doors — the same words the opening
   plays on a desk (Opening.tsx) */
const FirstScreen = ({ doors }: { doors: ReactNode }) => (
  <Wrap className="relative min-h-[100svh] flex flex-col items-center justify-center text-center pt-[6.5rem] pb-[6rem]" data-landing-hero>
    <Kicker />
    <Quote className="mt-6 text-[clamp(2.4rem,9.6vw,4rem)] lg:text-[clamp(4rem,min(8.4vw,14.5svh),8.5rem)]" />
    <Tease className="mt-8 max-w-[54rem]" />
    <div className="landing-rise [--rise-delay:700ms] mt-9 flex flex-wrap items-center justify-center gap-3" data-landing-hero-doors>
      {doors}
    </div>
    <Cue className="absolute bottom-7 left-1/2 -translate-x-1/2" />
  </Wrap>
);

/* THE ANSWER, STILL (a phone, less motion): "Trade what you can see." over the terminal itself, the desk an account lands
   on, in use */
const Reveal = () => {
  const ground = useBlockGround();
  const small = useStacked();
  const head = useArrival<HTMLDivElement>();
  return (
    <Wrap className="pb-[10vh]" data-landing-reveal>
      <div ref={head} className="landing-lines text-center">
        <h2 className="landing-line landing-settle [--i:0] font-light tracking-[-0.045em] leading-[0.98] text-[clamp(2.25rem,8vw,4.25rem)] [text-wrap:balance]">
          Trade what you can <Foil>see.</Foil>
        </h2>
      </div>
      <figure className="mt-8 lg:mt-10" data-landing-hero-window>
        <TerminalWindow path={HERO.path} theme={ground} desk={!small} natural panel boot="switch" />
        <figcaption className="mt-4 text-[0.8125rem] text-textMuted">The terminal itself, in use — played three times as fast.</figcaption>
      </figure>
    </Wrap>
  );
};

/** WHAT THE SESSION SAYS FIRST, beside its window as the opening hands it over (Session.tsx `story.lead`) */
const Lead = () => (
  <div>
    <Eyebrow>How it works</Eyebrow>
    <h2 className="mt-6 font-light tracking-[-0.035em] leading-[1.04] text-[1.875rem] xl:text-[2.125rem] [text-wrap:balance] outline-none">
      Slayer reads it all together, <span className="block text-textMuted">on one screen, while the session moves.</span>
    </h2>
    <p className="mt-5 max-w-[34ch] text-[0.9375rem] leading-[1.55] text-textSecondary">
      Three moments from one session on SPY, each read off the terminal as it ran. Scroll, and the session plays between them.
    </p>
  </div>
);

/* THE QUOTE, THE ANSWER AND THE SESSION — ONE STORY, ON A DESK: the opening plays over the session's top (Opening.tsx), and
   the terminal it opens goes to stand as the session's own window (Session.tsx `story`). "See how it works" and the bar's
   "How it works" go to where the session's first words stand beside it (the #how marker). */
const Story = ({ theme, doors }: { theme: Ground; doors: ReactNode }) => {
  const stage = useRef<HTMLDivElement | null>(null);
  const screen = useRef<HTMLDivElement | null>(null);
  const intro = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  /* the opening's own picture has gone: the session's camera may leave the whole desk (Session.tsx) */
  const [landed, setLanded] = useState(false);
  const targets = useMemo(() => ({ stage, screen, intro }), []);
  const hold = useMemo<StoryHold>(() => ({ ...targets, shown: near, landed, lead: <Lead /> }), [targets, near, landed]);
  const onNear = useCallback(() => setNear(true), []);
  return (
    <div className="relative" data-story>
      <span
        id="how"
        data-focus="[data-session-lead] h2"
        aria-hidden="true"
        className="absolute left-0 w-px h-px pointer-events-none"
        style={{ top: `${HOW_AT * (TRACK - 100)}svh`, scrollMarginTop: 0 } as CSSProperties}
      />
      <Opening theme={theme} story={targets} onNear={onNear} onLanded={setLanded} doors={doors} />
      <Wrap className="relative">
        <Session theme={theme} story={hold} />
      </Wrap>
    </div>
  );
};

/** THE ROOMS' HEAD — over the wall on a desk, over the tabs on a phone */
const RoomsHead = ({ stage }: { stage: boolean }) => (
  <Head
    id="rooms-head"
    eyebrow="The rooms"
    first={`${ROOM_COUNT} rooms.`}
    second="One terminal."
    aside={stage ? 'Each room opens on its own page. Scroll on, and walk through them one at a time.' : 'Each room opens on its own page. Pick one to see it play.'}
  />
);

/** A READ, NEVER AN INSTRUCTION — what the terminal does and never does, and what every number stands on (what it
    produces, never how) */
const Trust = () => (
  <Wrap>
    <Head
      eyebrow="Why Slayer"
      first="A read."
      second="Never an instruction."
      aside="Every figure starts from the market’s own record and is worked out by fixed rules, so the same market gives the same read every time. What it shows is open; how it works each one out stays ours."
    />
    <div className="mt-10 lg:mt-12 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10" data-landing-does>
      <div>
        <h3 className="text-[0.75rem] font-medium uppercase tracking-[0.22em] text-textPrimary">It does</h3>
        <ul className="mt-4 border-t border-borderSubtle">
          {IT_DOES.map(t => (
            <li key={t} className="py-3.5 border-b border-borderSubtle flex items-start gap-3 text-[0.9375rem] leading-snug text-textPrimary">
              <Check className="w-4 h-4 mt-[0.1875rem] shrink-0 text-textPrimary" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-[0.75rem] font-medium uppercase tracking-[0.22em] text-textMuted">It never</h3>
        <ul className="mt-4 border-t border-borderSubtle">
          {IT_NEVER.map(t => (
            <li key={t} className="py-3.5 border-b border-borderSubtle flex items-start gap-3 text-[0.9375rem] leading-snug text-textSecondary">
              <Minus className="w-4 h-4 mt-[0.1875rem] shrink-0 text-textMuted" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
    <div className="mt-14 lg:mt-16" data-landing-kinds>
      <h3 className="text-[0.75rem] font-medium uppercase tracking-[0.22em] text-textMuted">What every number stands on</h3>
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 border-t border-borderSubtle md:divide-x divide-borderSubtle">
        {KINDS.map(k => (
          <div key={k.name} className="py-6 md:px-8 first:md:pl-0 last:md:pr-0 border-b border-borderSubtle md:border-b-0">
            <p className="text-[1.3125rem] font-light tracking-[-0.02em]">{k.name}</p>
            <p className="mt-1 text-[0.875rem] text-textSecondary">{k.says}</p>
            <ul className="mt-4">
              {k.items.map(t => (
                <li key={t} className="py-2 border-t border-borderSubtle text-[0.84375rem] leading-snug text-textPrimary">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <a
        href="/legal/data"
        className="group/door mt-6 inline-flex items-center gap-2 text-[0.84375rem] text-textSecondary hover:text-textPrimary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver rounded-sm"
        data-landing-door="data"
      >
        The Data page, in full
        <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover/door:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
      </a>
    </div>
  </Wrap>
);

/** ONE TERMINAL, IN PLACE OF… what a trader would otherwise keep open beside it */
const InPlaceOf = () => (
  <div className="mt-12 lg:mt-14 flex flex-col lg:flex-row lg:items-start gap-x-8 gap-y-4" data-landing-in-place-of>
    <p className="shrink-0 text-[0.75rem] font-medium uppercase tracking-[0.22em] text-textMuted lg:pt-[0.6875rem]">One terminal, in place of</p>
    <ul className="flex flex-wrap gap-2">
      {IN_PLACE_OF.map(t => (
        <li key={t.text} className="h-9 pl-2 pr-3.5 inline-flex items-center gap-2 rounded-full border border-borderSubtle text-[0.84375rem] text-textSecondary">
          <ProductGlyph name={t.glyph} size={14} bare className="size-[0.875rem]" />
          {t.text}
          {/* the room that does it, in words as well as on its glyph */}
          <span className="-ml-1 text-textMuted">· {t.room}</span>
        </li>
      ))}
    </ul>
  </div>
);

/** HOW MUCH IS IT? — ONE PLAN: its name, its price, who it is for, the one difference, its door */
const Plan = ({ planKey, onChoose }: { planKey: PlanKey; onChoose: (key: PlanKey) => void }) => {
  const plan = PLANS.find(p => p.key === planKey)!;
  const custom = plan.monthly == null;
  const u = useUnit();
  const glyph = PLAN_GLYPH[planKey];
  return (
    <div className="flex flex-col py-8 lg:px-8 first:lg:pl-0 last:lg:pr-0" data-landing-plan={planKey}>
      <div className="flex items-center gap-3">
        {glyph ? <ProductGlyph name={glyph} size={24} bare className="shrink-0 size-[1.5rem]" /> : <SlayerMark size={26 * u} bare label="" />}
        <h3 className="text-[1.125rem] font-medium tracking-tight">{plan.name}</h3>
      </div>
      {/* the page's big numbers are its prices — the only figures of ours it shows */}
      <p className="mt-6 flex items-baseline gap-2">
        <span className="text-[2.375rem] sm:text-[2.75rem] font-light leading-none tracking-[-0.045em] tnum">{plan.price}</span>
        {!custom && <span className="text-[0.9375rem] text-textMuted">{plan.period}</span>}
      </p>
      <dl className="mt-6 border-t border-borderSubtle">
        <div className="py-3.5 border-b border-borderSubtle">
          <dt className="text-[0.75rem] text-textMuted">For</dt>
          <dd className="mt-1 text-[0.9375rem] leading-snug text-textPrimary">{PLAN_FOR[planKey]}</dd>
        </div>
        <div className="py-3.5 border-b border-borderSubtle">
          <dt className="text-[0.75rem] text-textMuted">Holds</dt>
          <dd className="mt-1 text-[0.9375rem] leading-snug text-textSecondary">{PLAN_HOLDS[planKey]}</dd>
        </div>
      </dl>
      <div className="mt-7 lg:mt-auto lg:pt-7">
        {custom ? (
          /* the letter arrives saying which plan it is about */
          <Pill href={`mailto:${COMPANY.info}?subject=${encodeURIComponent(`The ${plan.name} plan`)}`} kind="ghost" testId={`plan-${planKey}`}>
            Talk to us
          </Pill>
        ) : (
          <Pill href={`/signup?plan=${planKey}`} onClick={() => onChoose(planKey)} kind="ghost" testId={`plan-${planKey}`}>
            Choose {plan.name}
          </Pill>
        )}
      </div>
    </div>
  );
};

/** EVERY PLAN, SIDE BY SIDE — PLAN_ROWS read whole, folded under its own door so the prices stay the end of the section */
const Compare = () => {
  const [open, setOpen] = useState(false);
  /* "Soon" is a ghost pill, outlined (the Logo System's own) */
  const mark = (h: Holds) =>
    h === 'soon' ? (
      <span className="h-[1.25rem] px-2 inline-flex items-center rounded-full border border-borderMuted text-[0.625rem] font-medium uppercase tracking-[0.12em] text-textSecondary">Soon</span>
    ) : h ? (
      <>
        <Check className="w-4 h-4 text-textPrimary" aria-hidden="true" />
        <span className="sr-only">Included</span>
      </>
    ) : (
      <>
        <span className="text-textMuted" aria-hidden="true">
          –
        </span>
        <span className="sr-only">Not included</span>
      </>
    );
  return (
    <div className="mt-10" data-landing-side-by-side={open || undefined}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="landing-plans-table"
        className="door-edge group inline-flex items-center gap-2 h-10 pl-4 pr-3.5 rounded-full border border-borderMuted text-[0.84375rem] font-medium text-textPrimary hover:border-transparent hover:bg-ink/[0.05] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver"
        data-landing-side-by-side-door
      >
        {open ? 'Fold the comparison away' : 'Compare the plans in full'}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id="landing-plans-table" className="mt-6 overflow-x-clip animate-fade-in">
          <table className="w-full min-w-[21.25rem] border-collapse text-left">
            <caption className="sr-only">What each plan holds</caption>
            {/* the plans' names stay over the rows they label while the table scrolls under the bar; the bar's own band above
                them is the ground's, so the rows never show through over the names */}
            <thead className="sticky top-[4.25rem] z-10 bg-canvas shadow-[0_-4.25rem_0_0_rgb(var(--canvas))]">
              <tr className="border-b border-borderSubtle">
                <th scope="col" className="py-3 pr-3 sm:pr-4 align-bottom font-mono text-[0.6875rem] font-normal uppercase tracking-[0.22em] text-textMuted">
                  What it holds
                </th>
                {PLANS.map(p => (
                  <th key={p.key} scope="col" className="py-3 px-1 sm:px-3 w-[4rem] sm:w-[18%] text-center align-bottom">
                    <span className="block text-[0.8125rem] sm:text-[0.9375rem] font-medium text-textPrimary">{p.name}</span>
                    <span className="block text-[0.6875rem] sm:text-[0.75rem] font-normal text-textMuted tnum">
                      {p.price}
                      {p.monthly != null && ` ${p.period}`}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_ROWS.map(r => (
                <tr key={r.text} className="border-b border-borderSubtle">
                  <th scope="row" className="py-3 pr-3 sm:pr-4 font-normal">
                    <span className="flex items-center gap-2.5 text-[0.8125rem] sm:text-[0.875rem] leading-snug text-textSecondary">
                      {r.glyph ? <ProductGlyph name={r.glyph} size={18} bare className="shrink-0 size-[1.125rem]" /> : <span className="w-[1.125rem] shrink-0" aria-hidden="true" />}
                      {r.text}
                    </span>
                  </th>
                  {PLAN_ORDER.map(k => (
                    <td key={k} className="py-3 px-1 sm:px-3 text-center">
                      <span className="inline-flex items-center justify-center">{mark(r.in[k])}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ---- the page ------------------------------------------------------------------------------ */

const Page = () => {
  const { a } = useGround();
  const calm = useReducedMotion();
  /* a phone, a tablet, or a screen taller than it is wide: one thing under another (scale.ts) */
  const small = useStacked();
  /* a desk where motion is welcome: the opening plays the quote into the terminal, and the rooms are one stage */
  const stage = !calm && !small;
  const { launch } = useLaunch();
  const open = useCallback((path: string) => launch(path), [launch]);
  const navigate = useNavigate();
  /* "Sign up free": the account form, outside the terminal; a plan's door names the plan */
  const signUp = useCallback(() => navigate('/signup'), [navigate]);
  const faqHead = useArrival<HTMLDivElement>();
  const choose = useCallback((key: PlanKey) => navigate(`/signup?plan=${key}`), [navigate]);

  /* WHERE THE KEYS LAND: a control the keys move to stands clear of the floating bar. The browser scrolls a control in only
     when none of it is on screen; one it can partly see stays where it is, under the bar — so, a frame after the keys land,
     it is brought down to where it can be read. */
  useEffect(() => {
    let raf = 0;
    const landed = (e: FocusEvent) => {
      const el = e.target;
      if (!(el instanceof HTMLElement) || el.tabIndex < 0 || el.closest('header')) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (document.activeElement !== el || !el.matches(':focus-visible')) return;
        const top = el.getBoundingClientRect().top;
        const clear = 88 * unit();
        if (top < clear) window.scrollBy({ top: top - clear, behavior: 'auto' });
      });
    };
    document.addEventListener('focusin', landed);
    return () => {
      document.removeEventListener('focusin', landed);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* THE TERMINAL'S SHELL, fetched once the page stands and the network has gone quiet (components/layout/shell.ts — it is
     not in the script the landing waits for), so a door into the terminal still opens at once */
  useEffect(() => {
    if (savingData()) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let idle = 0;
    const t = window.setTimeout(() => {
      if (w.requestIdleCallback) idle = w.requestIdleCallback(warmShell, { timeout: 4000 });
      else warmShell();
    }, 2500);
    return () => {
      window.clearTimeout(t);
      if (idle) w.cancelIdleCallback?.(idle);
    };
  }, []);

  /* a link from elsewhere lands on /#pricing or /#faq (the not-found page suggests /#pricing) — go there once the page stands */
  useEffect(() => {
    if (!location.hash) return;
    const t = window.setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ block: 'start' }), 80);
    return () => window.clearTimeout(t);
  }, []);

  const doors = (
    <>
      <Pill href="/signup" onClick={signUp} testId="hero">
        Sign up free
      </Pill>
      <Pill href="#how" onClick={() => toAnchor('#how')} kind="ghost" testId="how">
        See how it works
      </Pill>
    </>
  );

  return (
    <div className="relative isolate min-h-screen overflow-x-clip font-sans bg-canvas" data-landing="v5" data-theme={a}>
      <a href="#how" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-panel focus:text-textPrimary">
        Skip to how it works
      </a>
      <Nav ground={a} />

      {/* ── THE QUOTE, THE ANSWER, THE SESSION ────────────────────────────────────────────────── */}
      {/* on a desk, one story: the quote turns into its answer and opens into the terminal, which goes to stand beside the
          session (Story); on a phone, or where less motion is asked for, the first screen still, the terminal under it,
          and the session's head and moments */}
      {stage ? (
        <Block on="a" as="div" className="pb-[2vh]">
          <Story theme={a} doors={doors} />
        </Block>
      ) : (
        <>
          <Block on="a" as="div">
            <FirstScreen doors={doors} />
          </Block>
          <Block on="a" label="The terminal">
            <Reveal />
          </Block>
          <Block on="a" id="how" label="How it works" className="pb-[6vh] scroll-mt-10">
            <Wrap>
              <Head
                eyebrow="How it works"
                first="One session,"
                second="as the terminal saw it."
                aside={<>Three moments from one session on SPY, each read off the terminal as it ran.{!small && !calm && ' Scroll, and the session plays between them.'}</>}
              />
              <div className={small ? 'mt-6' : 'mt-6 lg:mt-0'}>
                <Session theme={a} />
              </div>
            </Wrap>
          </Block>
        </>
      )}

      {/* ── THE ROOMS ─────────────────────────────────────────────────────────────────────────── */}
      {stage ? (
        <Block on="a" label="The rooms">
          <Rooms rooms={ROOMS} head={<RoomsHead stage />} turnSays={TURN_SAYS} onOpen={open} anchor="rooms" />
        </Block>
      ) : (
        <Block on="a" id="rooms" label="The rooms" className="py-[10vh] scroll-mt-10">
          <Wrap>
            <Rooms rooms={ROOMS} head={<RoomsHead stage={false} />} turnSays={TURN_SAYS} onOpen={open} />
          </Wrap>
        </Block>
      )}

      {/* ── A READ, NEVER AN INSTRUCTION ─────────────────────────────────────────────────────── */}
      <Block on="a" id="trust" label="Why Slayer" className="py-[10vh] scroll-mt-10 border-t border-borderSubtle">
        <Trust />
      </Block>

      {/* ── HOW MUCH IS IT? ───────────────────────────────────────────────────────────────────── */}
      <Block on="a" id="pricing" label="Pricing" className="py-[10vh] scroll-mt-10 border-t border-borderSubtle">
        <Wrap>
          <Head
            eyebrow="Pricing"
            first="Simple plans."
            second="Cancel any time."
            aside="Making an account is free. A plan opens the rooms; cancel a monthly plan whenever you like and keep it until the period you paid for ends."
          />
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 border-y border-borderSubtle divide-y lg:divide-y-0 lg:divide-x divide-borderSubtle">
            {PLAN_ORDER.map(k => (
              <Plan key={k} planKey={k} onChoose={choose} />
            ))}
          </div>
          <p className="mt-5 text-[0.8125rem] text-textMuted">Prices in US dollars.</p>
          <InPlaceOf />
          <Compare />
        </Wrap>
      </Block>

      {/* ── THE QUESTIONS, THE LAST DOOR, THE FOOTER ─────────────────────────────────────────── */}
      <Block on="a" id="faq" label="Questions" className="pt-[10vh] scroll-mt-10 border-t border-borderSubtle">
        <Wrap>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-16 gap-y-10">
            <div ref={faqHead} className="landing-lines lg:col-span-5 lg:sticky lg:top-28 lg:self-start">
              <div className="landing-line [--i:0]">
                <Eyebrow>Questions</Eyebrow>
              </div>
              <div className="landing-line landing-settle [--i:1]">
                <TwoTone className="mt-6" first="Asked" second="before you buy." />
              </div>
              <div className="landing-line [--i:2] mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Pill href={`mailto:${COMPANY.info}`} kind="ghost" size="sm" testId="write">
                  {COMPANY.info}
                </Pill>
                <span className="text-[0.8125rem] text-textMuted">Anything else, ask. A person reads it.</span>
              </div>
            </div>
            <dl className="lg:col-span-7 border-t border-borderSubtle">
              {FAQ.map(f => (
                <div key={f.q} className="py-5 border-b border-borderSubtle" data-landing-faq>
                  <dt className="text-[1.0625rem] font-medium tracking-tight">{f.q}</dt>
                  <dd className="mt-2 max-w-[62ch] text-[0.9375rem] leading-relaxed text-textSecondary">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* THE LAST WORDS — the rooms once more, a door each, and the line read by the scroll */}
          <div className="pt-[16vh] pb-[12vh] text-center" data-landing-close>
            <ul className="mb-12 mx-auto max-w-[24rem] sm:max-w-none grid grid-cols-4 sm:flex sm:flex-wrap justify-center gap-x-2 gap-y-5 sm:gap-x-5" aria-label="The rooms" data-landing-close-rooms>
              {ROOMS.map(r => (
                <li key={r.id}>
                  <a
                    href={r.path}
                    onClick={e => {
                      e.preventDefault();
                      open(r.path);
                    }}
                    aria-label={`Open ${r.name.replace(/^The /, 'the ')}`}
                    className="group flex flex-col items-center gap-2 sm:w-[4.5rem] rounded-[0.875rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-silver"
                    data-landing-close-room={r.id}
                  >
                    <ProductGlyph
                      name={r.glyph}
                      size={30}
                      bare
                      className="size-[1.875rem] max-sm:size-[1.75rem] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
                    />
                    <span aria-hidden="true" className="text-[0.75rem] leading-tight text-textMuted group-hover:text-textPrimary transition-colors whitespace-nowrap">
                      {r.name.replace(/^The /, '')}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <LitLines
              lines={[
                { text: 'Seen enough?', ink: 'text-textPrimary' },
                { text: 'Step inside.', ink: 'text-textMuted' },
              ]}
              className="mx-auto font-light tracking-[-0.045em] leading-[0.96] text-[clamp(2.5rem,6.4vw,6rem)] [text-wrap:balance]"
            />
            <div className="mt-9 flex justify-center">
              <Pill href="/signup" onClick={signUp} testId="close">
                Sign up free
              </Pill>
            </div>
            <p className="mt-5 text-[0.875rem] text-textMuted">An account is free. Look around before you choose a plan.</p>
          </div>
        </Wrap>
        <SiteFooter home />
      </Block>
    </div>
  );
};

const Landing = () => {
  /* the page grows with a big screen as one piece (scale.ts) */
  useLandingScale();
  return (
    <GroundProvider>
      <Page />
    </GroundProvider>
  );
};

export default Landing;
