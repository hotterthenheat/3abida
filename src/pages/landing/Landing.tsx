/*
==================================================
  SLAYER TERMINAL - LANDING (/) · v3

  Rebuilt 2026-09-19 after Noah turned the first
  rebuild down ("the tools we have arent even
  showcased… i meant more like a smooth transition…")
  and sent the sites that stand out to him, then: "i
  dont want randomly generated renders, i want the
  REAL thing from our website so it doesnt scream
  fake". What the very first page was is in
  docs/landing-page-reference.md.

  THE IDEA. There is ONE picture on this page and it
  is the terminal itself, in a window (TerminalWindow),
  wide under the headline, then docked beside the
  words while the page walks it through every tool
  (Tour). Nothing on the page is drawn to look like
  the product. It RAN in the window until the same
  evening; Noah then made it STILLS ("keep our
  interactive visuals but then make them static. i
  dont like the idea of people flickering through the
  website without any purchases. a static image breeds
  mystery and desire") — photographs of the real
  pages, taken by scripts/make-landing-shots.mjs.

  THE LOOK, from his references: very large light
  type with one marked word; every head in two tones;
  a small word over a short rule above it; features
  as rows on hairlines, not boxes; pill buttons; a
  bar that lifts into a floating pill; a lot of air.

  THE GROUND (ground.tsx) opens on the visitor's own
  theme, turns slowly into the other half way down
  the tour — the terminal in the window turns with
  it — and turns home again after the last tool. The
  page ENDS ON THE THEME IT BEGAN ON: the prices, the
  questions and the footer stand on the visitor's
  own ground.

  THE RULES IT KEEPS (memory: no-public-grades,
  plain-english-rule, landing-page-v2):
  · NO grade, score or performance claim of ours.
  · Plain English. Not a single buzzword.
  · NO REFUNDS is said KINDLY, IN THE QUESTIONS — not
    as a headline over the prices (Noah, 2026-09-19:
    "should be stated in the legal or questions
    section in a kind manner not a big bold section").
    The doors into the terminal stay until checkout
    and sign-in exist (his call, the same evening).
  · The page never says simulated, demo or fake (the
    owner, 2026-10-01), and nothing about a feed's
    speed or source.
  · Phones first: the paid traffic arrives from X.
  · The prices are data/billing.ts's. WHAT EACH PLAN
    HOLDS below is Noah's to re-decide.

  2026-10-01, after the owner had a look at another
  trading site's landing ("dont steal just get inspired
  so we can be better then them"): every room's heading
  wears its glyph; "Everything in it" (Everything.tsx)
  lists every page, each a door; the plans can be read
  side by side; the close wears the rooms' glyphs.
  Nothing of theirs is copied — no words, no layout —
  and nothing is claimed that the terminal cannot show
  on the spot. Then, the same day: "the first thing you
  see should be all the desks" — the hero is the wall
  of all eight rooms, each playing a sped-up film of
  the desk in use with only a cursor on it (Wall.tsx);
  no box round any logo; and the one door is "Sign up
  free" (there is no trial).

  THE AUDIT, THE SAME DAY (the owner: "now audit the
  landing page… think logically"): every line read
  against the terminal as it stands, every door
  pressed. The lines that had drifted say what is there
  now — the tape's side rail is gone, Compass's cards
  have four states, the Weigher's list is two cards,
  not every page has a guide nor every action a key —
  and a line under a picture says what the picture
  shows. A page that changes takes its line here with
  it (STEPS below, Everything.tsx's ROOMS).

  2026-10-03: the wall, then the dock, gave way to the
  first design again — one window under the words,
  playing the rooms in turn, the page change shown in
  the row of rooms and typed in the window's bar (the
  owner's partner: "similar to skylit … overstimulating
  … I love the first one"). See Hero below.
==================================================
*/

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Menu, Moon, Sun, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLANS, type PlanKey } from '../../data/billing';
import { COMPANY } from '../../data/company';
import { useLaunch } from '../../components/layout/LaunchTransition';
import SiteFooter from '../../components/layout/SiteFooter';
import { useMarketClock } from '../../brand/useMarketClock';
import { Block, GroundProvider, useBlockGround, useGround, type Ground } from './ground';
import Tour, { type TourStep } from './Tour';
import Everything, { FEATURE_COUNT, InPlaceOf, ROOM_COUNT, SHARED_COUNT } from './Everything';
import SlayerMark from '../../brand/SlayerMark';
import Wordmark from '../../brand/Wordmark';
import Signature from '../../brand/Signature';
import ProductGlyph from '../../brand/ProductGlyph';
import { PRODUCT_GROUPS } from '../../brand/products';
import type { GlyphName } from '../../brand/paths';

/** Where "Launch terminal" opens the terminal, and the page the tour's window shows before a room's words are on screen.
    The page's own call is "Sign up free" (the account form); the terminal behind this door is where an account goes. */
const DOOR = '/pulse';

/* THE BAR'S THREE WORDS (Slayer Logo System, Web and App · Landing): Products opens the menu of every product, one line
   each; Pricing and Questions are this page's own sections */
const NAV: { label: string; href: string }[] = [
  { label: 'Pricing', href: '#pricing' },
  { label: 'Questions', href: '#faq' },
];

/* THE TOUR. Every name, page and row here is a real one — the window opens it as the words arrive.
   THE ORDER IS NOAH'S (2026-09-20): Pulse · Compass · Terrain · Pinpoint, then the turn of the ground, then Trace · the
   Weigher · the Record. The codes are numbered off the order here, so moving a step is moving its block. */
const STEPS: TourStep[] = [
  {
    id: 'pulse',
    glyph: 'pulse',
    code: '01',
    kind: 'The desk',
    name: 'Pulse',
    lead: 'Your own desk of live panels.',
    rest: 'Add them, drag them, link them to one name or let each hold its own. It is kept the way you left it.',
    path: '/pulse',
    rows: [
      /* the row says what the window shows: the desk as scripts/landing-stage.mjs (SEED) arranges it — it named the
         Market Structure desk's ledger, which the film does not show (2026-10-01 audit) */
      { title: 'The desk', says: 'The chart beside the hedging at every strike, the setups and the earnings under them.', path: '/pulse' },
      { title: 'Four charts', says: 'Four names at once, each with its own timeframe and overlays.', path: '/pulse/board' },
    ],
  },
  {
    id: 'compass',
    glyph: 'compass',
    code: '02',
    kind: 'The contracts',
    name: 'Compass',
    lead: 'Option contracts picked off today’s levels.',
    /* the card's four states (compass/setupProcess.ts) — "moving", the one the films show most, went unnamed until the
       2026-10-01 audit */
    rest: 'Every card says where its setup stands — watch, active, moving or fading — and it changes as price moves.',
    path: '/compass',
    rows: [
      { title: 'The board', says: 'What cleared the bar on this sweep.', path: '/compass' },
      /* its picture was held back for an evening: the Tracker's cards printed "Confidence 92%", a score of ours, and none goes
         on a public page. They say the four words now (Noah, 2026-09-19), so the row has its picture again. */
      { title: 'Tracker', says: 'What you kept, followed to the close.', path: '/compass/tracker' },
    ],
  },
  {
    id: 'terrain',
    glyph: 'terrain',
    code: '03',
    kind: 'The chart',
    name: 'Terrain',
    lead: 'Charts, and nothing in the way.',
    rest: 'One to four side by side on one set of controls. The walls, the flip and the supreme go on the candles with one switch.',
    path: '/terrain',
    rows: [
      { title: 'The strike rail', says: 'The book beside the chart, strike by strike.' },
      { title: 'Your own scripts', says: 'Write an indicator in Pine and it draws on the chart.' },
      { title: 'Drawing tools', says: 'Lines, levels and notes that stay where you put them.' },
    ],
  },
  {
    id: 'pinpoint',
    glyph: 'pinpoint',
    code: '04',
    kind: 'The book',
    name: 'Pinpoint',
    lead: 'The whole book, by strike and by date.',
    rest: 'Where dealer hedging is heaviest, where it flips, and how each level has held today.',
    path: '/pinpoint/map',
    rows: [
      { title: 'The Map', says: 'Every strike and expiry, as a matrix or as a calendar.', path: '/pinpoint/map' },
      { title: 'Building', says: 'What was added to the book today, strike by strike.', path: '/pinpoint/building' },
      { title: 'At the wall', says: 'Does it hold or break, and what happens either way.', path: '/pinpoint/wall' },
      { title: 'Compare', says: 'Two names, side by side on one ruler.', path: '/pinpoint/compare' },
    ],
  },
  {
    id: 'themes',
    kind: 'Light and dark',
    name: 'Two themes',
    lead: 'Light mode too.',
    /* the room stands on the ground the page turned into: a visitor who came in on light is now reading on dark */
    leadFor: { dark: 'Dark mode too.', light: 'Light mode too.' },
    rest: 'Every page in the terminal works in both.',
    path: '/pinpoint/map',
    turn: true,
    turnSays: { dark: 'Dark for the night session.', light: 'Paper for a bright room.' },
    rows: [
      { title: 'Your choice', says: 'Pick dark or light in Settings, or let it follow your computer.' },
      { title: 'Same colours on every page', says: 'Green is up, red is down, magenta is the biggest strike.' },
    ],
  },
  {
    id: 'trace',
    glyph: 'trace',
    code: '05',
    kind: 'The tape',
    name: 'Trace',
    lead: 'Every print, as it happens.',
    /* the tape's side rail of top names left on 2026-09-12 (LiveTape.tsx) and the dark pool has its own page; the head of
       the tape names the top bull, the top bear and the largest print (2026-10-01 audit) */
    rest: 'Options sweeps and blocks, with the top bull, the top bear and the largest print named at the head of the tape, and dark-pool crosses on a page of their own.',
    path: '/trace/live-tape',
    rows: [
      { title: 'Live tape', says: 'The stream, newest first.', path: '/trace/live-tape' },
      { title: 'Net flow', says: 'Calls against puts, through the day.', path: '/trace/net-flow' },
      { title: 'Dark pool', says: 'Off-exchange crosses, largest first.', path: '/trace/dark-pool' },
      { title: 'Screener', says: 'Every contract, filtered your way.', path: '/trace/screener' },
    ],
  },
  {
    id: 'weigher',
    glyph: 'weigher',
    code: '06',
    kind: 'The scale',
    name: 'The Weigher',
    lead: 'Weigh any contract before you take it.',
    rest: 'The chart, the chain and your watchlist on one desk.',
    path: '/weigher',
    rows: [
      { title: 'The chain', says: 'Every strike and expiry for the name.' },
      /* two cards since 2026-09-14 — "One list" was the desk before (WeigherDesk.tsx) */
      { title: 'Positions and a watchlist', says: 'What you hold and what you watch, each row marked now, today and since it was added.' },
      { title: 'The position card', says: 'What a position would return at every price, on a ruler.' },
    ],
  },
  {
    id: 'dossier',
    glyph: 'dossier',
    code: '07',
    kind: 'The file on a name',
    name: 'Dossier',
    lead: 'Everything on file about a name.',
    /* five pages, not one screen: "every stock on one page" is the Stocks page */
    rest: 'The news, the earnings, what insiders and members of Congress filed, and every stock screened on one page.',
    path: '/dossier/news',
    rows: [
      { title: 'News', says: 'The wire, on a map.', path: '/dossier/news' },
      { title: 'Earnings', says: 'The calendar, and a page for each name.', path: '/dossier/earnings' },
      { title: 'Insiders', says: 'Who filed, what, and when.', path: '/dossier/insiders' },
      { title: 'Congress', says: 'Trades disclosed by members of Congress.', path: '/dossier/congress' },
      { title: 'Stocks', says: 'A plain read of any name: strong, good, caution or poor.', path: '/dossier/stocks' },
    ],
  },
  /* PRACTICE (Review until 2026-09-26, when paper trading and backtesting became one section), the eighth room. PAPER
     TRADING LEADS since 2026-09-26 (Noah: "i want the paper trading live to be the first one … change the practice headline
     to lead with paper trading"); until then OPTIONS BACKTESTING led (2026-09-20: "i want the emphasis to be put on the
     'options backtesting'… because thats not something you see everyday"), and it still stands second. OPTIONS ONLY since
     2026-09-30: Paper first ("on the paper trading remove all the futures and make it strictly Options trading"), then the
     futures backtest, taken out the same day. The brand above stays market-wide. Its pictures are the desks IN USE — the photographer starts an account or a session by the form's own
     doors, plays it forward and trades it (scripts/make-landing-shots.mjs). The lines were read against TradeZella
     ("Backtest your strategy in plain English", "replay it by hand, bar by bar"), Option Omega ("Backtest it. Automate
     it.") and ORATS ("Options Backtester") first: none of theirs are here. */
  {
    id: 'practice',
    glyph: 'practice',
    code: '08',
    kind: 'Paper trading and backtesting',
    name: 'Practice',
    /* the headline leads with paper trading, as the room's first row does (Noah, 2026-09-26) */
    lead: 'Paper trade today’s prices, or replay a past day’s.',
    /* SAID ONCE (2026-10-01 audit): the paragraph ran eleven lines on a desk and told the rows' story before the rows
       did — the targets and stops, the decay, the chain as quoted are theirs to say */
    rest: 'A practice account or a prop firm’s evaluation on the live feed, or a past day played back a minute at a time, the whole option chain as it was quoted. Calls, puts and spreads, and nothing reaches a broker. One journal keeps every closed trade.',
    /* paper trading leads the room (Noah, 2026-09-26: "i want the paper trading live to be the first one") — its still
       is the options desk in use, not the start page (the photographer's `photo=1` window, embed.ts) */
    path: '/practice/paper',
    rows: [
      { title: 'Paper trading, live', says: 'A practice account or a prop firm’s evaluation on today’s prices — options only, ordered from the chain, on the live feed.', path: '/practice/paper' },
      { title: 'Options, off the real chain', says: 'Pick any contract as it was quoted that minute. A same-day one loses value while you watch.', path: '/practice/backtest' },
      { title: 'Targets and stops that know decay', says: 'Set them on the contract’s price, or pin them to the stock’s. The chart shows where each one sits right now.' },
      { title: 'Your own rules', says: 'How many positions, what a trade may risk, where the day stops. A trade that breaks one is refused.' },
      { title: 'The journal', says: 'Every closed trade on its chart: what it did while you held it, your tags, your words.', path: '/practice/journal' },
    ],
  },
];

/** The tour's last words count its tools — "Seven rooms. One terminal." — off the list itself, so they cannot disagree with it */
const ROOMS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][STEPS.filter(s => s.code).length] ?? String(STEPS.filter(s => s.code).length);

/** The rooms the hero's window plays in turn — the tour's tools, in the tour's order (the turn is not a room) */
const HERO_ROOMS = STEPS.filter(s => s.code);

/* every line true of the terminal today — "every page" was not: Pulse, the Tracker, the Board and Practice have no guide
   (counted 2026-10-01) */
const IT_DOES = [
  'Shows where dealer hedging sits, and redraws it as the day moves',
  'Reads a contract against that and says it in a word: strong, good, caution or poor',
  'Keeps a setup current: watch while it forms, active while it holds, fading when it breaks',
  'Explains its reads in plain English',
];
const IT_NEVER = ['Tells you what to buy or sell', 'Places an order. It is not a broker', 'Boils a trade down to one number', 'Gives financial advice'];

/* WHAT EACH PLAN HOLDS — Noah's to re-decide (see the header). The prices come from data/billing.ts.
   A line marked `soon` is sold with the plan but not open yet, and says so: Community is one room behind
   the terminal's "coming soon" wall (Noah, 2026-09-19: it goes on the Compass plan, marked).
   REVIEW IS ON THE COMPASS PLAN (Noah, 2026-09-20: "review is in compass") — its line leads with the rare thing, as its
   room on the tour does.

   ONE LIST, TWO READINGS (2026-10-01): every line any plan holds, once, with the plans that hold it. The cards read it
   as "everything in the plan before, and…" (their words unchanged), and the plans side by side read it whole — so the
   two can never disagree. Re-deciding a plan is changing its letters here. */
type Holds = boolean | 'soon';
interface PlanRow {
  text: string;
  glyph?: GlyphName;
  in: Record<PlanKey, Holds>;
}
const PLAN_ROWS: PlanRow[] = [
  { text: 'Pulse, your desk of live panels', glyph: 'pulse', in: { pinpoint: true, compass: true, lifetime: true } },
  /* YOUR SCRIPTS COME WITH TERRAIN, ON EVERY PLAN (2026-10-01, the owner: "scripts do what u think is best"). They were a
     Compass line of their own while the tour showed them under Terrain, which every plan holds — and Terrain's own line
     (nav.ts) is "your Pine scripts, your drawings". Nothing in the terminal is held back by plan, so the list was the
     only thing that disagreed. */
  { text: 'Terrain, the levels on the chart and your own scripts', glyph: 'terrain', in: { pinpoint: true, compass: true, lifetime: true } },
  { text: 'Pinpoint, the book by strike and by date', glyph: 'pinpoint', in: { pinpoint: true, compass: true, lifetime: true } },
  { text: 'Trace, the tape and the dark pool', glyph: 'trace', in: { pinpoint: true, compass: true, lifetime: true } },
  { text: 'Alerts on any level', glyph: 'alerts', in: { pinpoint: true, compass: true, lifetime: true } },
  { text: 'Compass, contracts that fit the levels', glyph: 'compass', in: { pinpoint: false, compass: true, lifetime: true } },
  { text: 'The Weigher, for any contract you name', glyph: 'weigher', in: { pinpoint: false, compass: true, lifetime: true } },
  { text: 'Dossier: news, earnings, insiders, Congress, stocks', glyph: 'dossier', in: { pinpoint: false, compass: true, lifetime: true } },
  { text: 'Practice: paper trading, backtesting and the journal', glyph: 'practice', in: { pinpoint: false, compass: true, lifetime: true } },
  /* off the terminal's menu until it opens, and sold here marked "coming soon" — the owner, 2026-10-01: "community is coming
     real soon" */
  { text: "Community, the traders' room", glyph: 'community', in: { pinpoint: false, compass: 'soon', lifetime: 'soon' } },
  { text: 'One payment, nothing recurring', in: { pinpoint: false, compass: false, lifetime: true } },
  { text: 'A one-to-one session to set up your desk', in: { pinpoint: false, compass: false, lifetime: true } },
  { text: 'New tools before anyone else', in: { pinpoint: false, compass: false, lifetime: true } },
];
const PLAN_ORDER: PlanKey[] = ['pinpoint', 'compass', 'lifetime'];
/** what the plan before this one is called on its card: "Everything in Pinpoint", "Everything in Compass, for good" */
const EVERYTHING_IN: Partial<Record<PlanKey, string>> = { compass: 'Everything in Pinpoint', lifetime: 'Everything in Compass, for good' };

type Hold = string | { text: string; soon: true };
/** A card's lines: the plan before it in one line, then what this plan adds */
const holdsOf = (key: PlanKey): Hold[] => {
  const before = PLAN_ORDER[PLAN_ORDER.indexOf(key) - 1];
  const adds = PLAN_ROWS.filter(r => r.in[key] && !(before && r.in[before]));
  return [...(EVERYTHING_IN[key] ? [EVERYTHING_IN[key]!] : []), ...adds.map(r => (r.in[key] === 'soon' ? { text: r.text, soon: true as const } : r.text))];
};

/* WHICH IS FOR ME — one line a plan, said from the trader's side: what they do, not what we sell */
const PLAN_FOR: Record<PlanKey, string> = {
  pinpoint: 'You read the levels and the tape, and make your own calls.',
  compass: 'You also want contracts picked off the levels, the Weigher, the Dossier and Practice.',
  lifetime: 'You want all of it for good, paid once, with a session to set up your desk.',
};

/* THE QUESTIONS — the Logo System's FAQ bank (09 · Voice / 10 · Messaging, 2026-09-30), one of the page's own kept (the
   pictures). No refunds, said kindly, here and never as a banner. The page never says simulated, demo or fake (the
   owner, 2026-10-01). Two left the list on 2026-10-01: "How do I reach you?" (the address stands beside the head as a
   door, with the same words, so the section said it twice), and "Where does the data come from?" (the owner: "remove
   that because this is a local host site nobodies on it yet im just building it" — it answered with licences not yet
   signed). */
const FAQ: { q: string; a: string }[] = [
  { q: 'Alerts or signals?', a: 'Alerts. You set a level and Slayer tells you when price gets there. It never tells you what to buy or sell.' },
  { q: 'How is it different?', a: 'It puts the prints, the positions, the levels and the filings on one screen, and says where each number comes from.' },
  { q: 'Do I need to know options?', a: 'No. Pinpoint shows levels on a price chart. The guides explain each term in plain words.' },
  { q: 'Are the pictures on this page real?', a: 'Yes. Every picture and every film is the terminal itself, taken from the real page, not a mock-up. The films run three times as fast as life.' },
  { q: 'Can I cancel?', a: 'Yes, any time in Settings. Your plan runs to the end of the period you paid for.' },
  { q: 'Do you offer refunds?', a: 'We don\u2019t. Making an account is free, and every desk is on this page, so see what each plan holds before you pay. If a charge ever looks wrong, write to billing@slayerterminal.com and a person will look into it.' },
];

/* ---- the pieces ---------------------------------------------------------------------------- */

const Wrap = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10 ${className}`}>{children}</div>;

/** ONE SMALL WORD OVER A SHORT BAR — above every head on the page, the Logo System's section label ("01 · Landing") */
const Eyebrow = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col items-start gap-2.5">
    <p className="text-[13px] text-textMuted">{children}</p>
    <span className="w-10 h-[3px] rounded-full bg-silver" aria-hidden="true" />
  </div>
);

/** EVERY HEAD IS TWO LINES IN TWO TONES: what it is in ink, the turn of the thought in grey */
const TwoTone = ({ first, second, className = '' }: { first: string; second: string; className?: string }) => (
  <h2 className={`font-light tracking-[-0.04em] leading-[1.02] text-[40px] sm:text-[56px] lg:text-[72px] [text-wrap:balance] ${className}`}>
    {first} <span className="block text-textMuted">{second}</span>
  </h2>
);

/* THE LAST WORDS, READ BY SCROLLING (2026-10-02, from the owner's notes on two landings that make a line's reading the
   scroll itself): each letter of the closing lines stands faint and turns to its own ink, one letter at a time, as the
   lines come up the screen — the scroll is the playhead, stepped letter by letter, and scrolling back takes them back.
   A reader that hears the page hears the lines whole (the label); where less motion is asked for, they stand lit. Only
   the letters that change are touched, and only while the lines are near the screen. */
const LitLines = ({ lines, className = '' }: { lines: { text: string; ink: string }[]; className?: string }) => {
  const ref = useRef<HTMLHeadingElement | null>(null);
  const calm = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || calm) return;
    const letters = Array.from(el.querySelectorAll<HTMLElement>('[data-letter]'));
    let lit = -1;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const top = el.getBoundingClientRect().top;
      const vh = window.innerHeight;
      /* from when the lines' top is nine tenths of the way down the screen to when it is two fifths of the way */
      const p = Math.max(0, Math.min(1, (vh * 0.9 - top) / (vh * 0.5)));
      const n = Math.round(p * letters.length);
      if (n === lit) return;
      const from = lit < 0 ? 0 : Math.min(n, lit);
      const to = lit < 0 ? letters.length : Math.max(n, lit);
      for (let i = from; i < to; i++) letters[i].dataset.lit = i < n ? 'on' : 'off';
      lit = n;
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(paint);
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
    and the foil stays on "Launch terminal" alone; ghost is a hairline. No arrows: the brand's pills say where they go in
    words. NO GROWING UNDER THE POINTER (2026-09-20: "look laggy" — a 2% scale re-draws the words between two pixel grids
    every frame): the ghost answers with its edge and a wash, the solid with a breath of its own ink; only a press gives. */
const Pill = ({ children, onClick, href, kind = 'solid', size = 'lg', testId }: { children: ReactNode; onClick?: () => void; href: string; kind?: 'solid' | 'ghost'; size?: 'lg' | 'sm'; testId?: string }) => {
  const fill = kind === 'solid' ? 'bg-textPrimary text-canvas hover:bg-textPrimary/90' : 'border border-borderMuted text-textPrimary hover:border-textPrimary/70 hover:bg-ink/[0.06]';
  return (
    <a
      href={href}
      onClick={e => {
        if (!onClick) return;
        e.preventDefault();
        onClick();
      }}
      data-landing-door={testId}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-[0.98] active:duration-100 motion-reduce:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-silver ${size === 'lg' ? 'h-12 px-7 text-[15px]' : 'h-9 px-4 text-[13px]'} ${fill}`}
    >
      {children}
    </a>
  );
};

/** A jump along the page glides — unless the visitor asked their system for less motion: then it is a cut. Pricing is
    twelve thousand pixels down; gliding there was the motion they had asked not to see. */
const glideOrCut = (): ScrollBehavior => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

const toAnchor = (href: string) => {
  document.querySelector(href)?.scrollIntoView({ behavior: glideOrCut(), block: 'start' });
  history.replaceState(null, '', href);
};

/** THE PRODUCTS MENU (Slayer Logo System, 06 · Menu and rail: "Every product, one line each. Landing and app header."):
    the groups in the rail's order, each product beside its glyph (bare — no tile) with its one line. A pick opens it in the terminal. */
const ProductsMenu = ({ onPick, onEvery, compact = false }: { onPick: (path: string) => void; onEvery: () => void; compact?: boolean }) => (
  <div>
  {/* on a desk the groups FLOW in two columns (2026-10-01): laid in rows, the Practice group's four ran the panel past a
      laptop's screen, Journal cut off under the fold (measured at 1440 × 900) */}
  <div className={compact ? 'flex flex-col' : 'columns-2 gap-x-10'} data-landing-products>
    {PRODUCT_GROUPS.map(g => (
      <div key={g.caption} className={compact ? 'pt-3' : 'break-inside-avoid pb-5'}>
        <p className="text-[11px] uppercase tracking-[0.14em] text-textMuted">{g.caption}</p>
        <ul className={compact ? 'mt-1' : 'mt-2.5 flex flex-col gap-1'}>
          {g.products.map(p => (
            <li key={p.name}>
              <a
                href={p.path}
                onClick={e => {
                  e.preventDefault();
                  onPick(p.path);
                }}
                className={`group flex items-start gap-3 rounded-xl transition-colors hover:bg-ink/[0.05] ${compact ? 'py-2 px-1' : 'p-2 -mx-2'}`}
                data-landing-product={p.name}
              >
                <ProductGlyph name={p.glyph} size={compact ? 20 : 26} bare className="shrink-0 mt-[1px]" />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-textPrimary leading-tight">{p.name}</span>
                  {!compact && <span className="mt-0.5 block text-[13px] leading-snug text-textSecondary max-w-[36ch]">{p.line}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
  {/* every page of every room, on this page (Everything.tsx) */}
  <a
    href="#everything"
    onClick={e => {
      e.preventDefault();
      onEvery();
    }}
    className={`group mt-4 flex items-center justify-between gap-3 border-t border-borderSubtle text-[13.5px] text-textSecondary hover:text-textPrimary transition-colors ${compact ? 'pt-3 pb-1' : 'pt-4'}`}
    data-landing-products-every
  >
    Every page, by room
    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
  </a>
  </div>
);

/** THE BAR. Flat across the top of the page with the wordmark; once the page moves it lifts into a floating pill of glass
    and the wordmark gives way to the mark (the Logo System's own two frames). It wears the ground that is under it, so it
    turns when the page does. */
const Nav = ({ ground }: { ground: Ground }) => {
  const { a, flip } = useGround();
  const { launch } = useLaunch();
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const [lifted, setLifted] = useState(false);
  useMotionValueEvent(scrollY, 'change', y => setLifted(y > 24));
  /* THE PHONE'S MENU (2026-09-19): under 768px the bar's links were simply gone — a visitor on a phone, which is most
     of them, had no way to Pricing or the questions but to scroll for them. A button opens them as a small sheet under the
     bar, in the page's own grammar: rows on hairlines. It closes on a pick, on Escape, and on a tap outside it. */
  const [menu, setMenu] = useState(false);
  /* the Products menu on a desk: opens under its word, closes the same ways */
  const [products, setProducts] = useState(false);
  useEffect(() => {
    if (!menu && !products) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false);
        setProducts(false);
      }
    };
    const down = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('[data-landing-menu], [data-landing-menu-door], [data-landing-products-panel], [data-landing-products-door]')) {
        setMenu(false);
        setProducts(false);
      }
    };
    window.addEventListener('keydown', key);
    document.addEventListener('pointerdown', down, true);
    return () => {
      window.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', down, true);
    };
  }, [menu, products]);
  const pick = (path: string) => {
    setMenu(false);
    setProducts(false);
    launch(path);
  };
  const glide = 'transition-[max-width,background-color,border-color,box-shadow,padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';
  /* "Holographic silver · in the S and on Launch terminal only" — the foil on black, the ink on paper (a foil is a surface
     and would vanish there) */
  const launchFill = ground === 'dark' ? 'holo-bg text-[#0a0a0a]' : 'bg-textPrimary text-canvas';
  return (
    <header data-theme={ground} className="fixed top-0 inset-x-0 z-40 flex justify-center px-3 sm:px-4 pt-2.5 sm:pt-3.5 pointer-events-none" data-landing-nav={ground} data-lifted={lifted || undefined}>
      <div
        className={`pointer-events-auto relative w-full h-[52px] flex items-center gap-2 sm:gap-4 rounded-full border ${glide} ${
          lifted ? 'max-w-[700px] pl-2.5 pr-1.5 border-borderSubtle bg-panel/75 backdrop-blur-xl shadow-[0_16px_50px_-20px_rgb(0_0_0/0.55)]' : 'max-w-[1408px] pl-1 sm:pl-2 lg:pl-6 pr-0 sm:pr-1 lg:pr-5 border-transparent bg-transparent'
        }`}
      >
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: glideOrCut() })} className="shrink-0 inline-flex items-center select-none" aria-label="Slayer Terminal, back to the top" data-landing-brand>
          {/* the wordmark on the open bar, the mark on the lifted pill and on a phone */}
          <span className={lifted ? 'hidden' : 'hidden sm:inline-flex'}>
            <Wordmark height={15} cursor label="" />
          </span>
          <span className={lifted ? 'inline-flex' : 'sm:hidden inline-flex'}>
            <SlayerMark size={26} bare near label="" />
          </span>
        </button>
        <nav className="hidden md:flex items-center gap-1 mx-auto" aria-label="On this page">
          <button
            type="button"
            onClick={() => setProducts(o => !o)}
            aria-expanded={products}
            aria-controls="landing-products"
            className={`h-8 pl-3.5 pr-2.5 inline-flex items-center gap-1 rounded-full text-[13.5px] transition-colors ${products ? 'text-textPrimary bg-ink/[0.06]' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06]'}`}
            data-landing-products-door
          >
            Products
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${products ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {NAV.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={e => {
                e.preventDefault();
                setProducts(false);
                toAnchor(l.href);
              }}
              className="h-8 px-3.5 inline-flex items-center rounded-full text-[13.5px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={flip}
          className="ml-auto md:ml-0 h-9 w-9 inline-flex items-center justify-center rounded-full text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-silver"
          aria-label={a === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
          title={a === 'dark' ? 'Light theme' : 'Dark theme'}
          data-landing-theme={a}
        >
          {a === 'dark' ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => setMenu(m => !m)}
          className="md:hidden h-9 w-9 inline-flex items-center justify-center rounded-full text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-silver"
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
          className={`h-10 px-4 sm:px-5 inline-flex items-center rounded-full text-[13.5px] font-medium whitespace-nowrap ${launchFill}`}
          data-landing-door="nav"
        >
          <span className="sm:hidden">Launch</span>
          <span className="hidden sm:inline">Launch terminal</span>
        </a>
        {/* the panel is centred by a still wrapper — the fade's own transform would undo a translate on the same box */}
        <div className="hidden md:block absolute top-[60px] left-1/2 -translate-x-1/2 w-[min(760px,calc(100vw-32px))]">
          <AnimatePresence>
            {products && (
              <motion.div
                id="landing-products"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="max-h-[calc(100svh-96px)] overflow-y-auto rounded-3xl border border-borderSubtle bg-panel/95 backdrop-blur-xl shadow-[0_24px_60px_-24px_rgb(0_0_0/0.6)] p-6"
                data-landing-products-panel
              >
                <ProductsMenu
                  onPick={pick}
                  onEvery={() => {
                    setProducts(false);
                    toAnchor('#everything');
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
            className="md:hidden pointer-events-auto absolute top-[70px] inset-x-3 max-h-[calc(100svh-90px)] overflow-y-auto rounded-3xl border border-borderSubtle bg-panel/95 backdrop-blur-xl shadow-[0_24px_60px_-24px_rgb(0_0_0/0.6)] px-5 pt-1 pb-4"
            data-landing-menu
          >
            <ProductsMenu
              onPick={pick}
              onEvery={() => {
                setMenu(false);
                toAnchor('#everything');
              }}
              compact
            />
            <div className="mt-3 border-t border-borderSubtle">
              {NAV.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={e => {
                    e.preventDefault();
                    setMenu(false);
                    toAnchor(l.href);
                  }}
                  className="flex items-center justify-between h-[52px] border-b border-borderSubtle text-[17px] text-textPrimary"
                >
                  {l.label}
                  <ArrowRight className="w-4 h-4 text-textMuted" aria-hidden="true" />
                </a>
              ))}
            </div>
            <a
              href="/signup"
              onClick={e => {
                e.preventDefault();
                setMenu(false);
                navigate('/signup');
              }}
              className="mt-4 h-12 flex items-center justify-center rounded-full text-[15px] font-medium bg-textPrimary text-canvas"
              data-landing-door="menu"
            >
              Sign up free
            </a>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
};

/* THE HEADLINE IS OURS (Noah, 2026-09-19). The first one — "Dealers have to hedge. See where." — turned out to sit a breath
   from a competitor's own hero, so the headline stopped leading with the dealers' obligation; Noah PICKED this one from four:
   "Trade what you can see." — short and blunt, in a trader's own voice, and true to a terminal that shows and never
   instructs. AND IT DOES NOT SAY "OPTIONS" (the same day): the hero speaks of THE MARKET and of TRADERS.

   THE BRAND'S HERO (Slayer Logo System, Web and App · Landing, 2026-09-30): one line, one button. The signature stands
   over the line, its last word in the foil; the market's own clock beside it.

   THE WINDOW, AGAIN (2026-10-03). From 2026-10-01 the first screen was every desk at once — a wall, then a dock of eight
   films. The owner's partner, of it: "the big card displays is first of all quite similar to skylit and secondly just
   looks overstimulating … I love the first one, but we will add in the little page change". So the first screen is the
   first design again — the words, the rooms in a row, and ONE window under them playing one room at a time (Tour.tsx:
   the window is the tour's own, and glides into its place beside the rooms as the page scrolls) — with the page change:
   the lit room's line fills as its film plays and, full, the next room lights; the window's bar types the page it opens
   and a band of light passes down the screen as the new one lands (TerminalWindow). The window is whole on the first
   screen, centred under the words, as large as they leave it. A room picked by hand stays. THE DOOR is "Sign up free" (the
   owner, 2026-10-01: "theirs no try to free you can sign up for free but that's it") — the account costs nothing; a plan
   opens the desks. */
const Hero = ({ onSignUp, rooms, at, onPick, line }: { onSignUp: () => void; rooms: TourStep[]; at: number; onPick: (i: number) => void; line: (el: HTMLSpanElement | null) => void }) => {
  const ground = useBlockGround();
  const clock = useMarketClock();
  return (
    /* in one column the window is a band of half the screen pinned under the bar (Tour.tsx), so the hero takes at least the
       other half: the first screen is the words and the window, and the first room's words wait below the fold (a tablet
       showed the room's head under the window) */
    <Wrap className={`flex flex-col max-lg:min-h-[50svh] pt-[84px] sm:pt-[100px] lg:pt-[96px] ${rooms.length ? 'pb-6 lg:pb-5' : 'pb-10 lg:pb-16'}`}>
      {/* the room left over in one column is shared above the words and above the rooms, so the words stand in the middle of
          it and the rooms on the window they choose for */}
      <div aria-hidden="true" className="flex-1 max-h-[12svh]" />
      <div className="landing-rise">
        {/* the market's own clock beside its word: New York's, where it keeps its hours */}
        <Signature className="text-[12px]" detail={<span className="tnum">· New York {clock}</span>} />
      </div>
      <h1 className="landing-rise [--rise-delay:60ms] mt-4 sm:mt-6 font-light tracking-[-0.045em] leading-[0.98] text-[clamp(2.5rem,min(6.3vw,10svh),5.9rem)] [text-wrap:balance]" data-landing-headline>
        Trade what you can{' '}
        {/* the foil's letters get room past their box (the headline's tight tracking would cut the "e"'s overhang — 2026-09-20) */}
        <span className={`font-medium inline-block px-[0.06em] -mx-[0.06em] ${ground === 'dark' ? 'holo-text' : 'text-silver'}`}>see.</span>
      </h1>
      <div className="landing-rise [--rise-delay:140ms] mt-4 sm:mt-5 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-x-10 gap-y-5">
        <p className="max-w-[40rem] text-[16px] sm:text-[18px] leading-[1.5] sm:leading-[1.55] text-textSecondary">
          Most of what moves a price is public, just scattered. Slayer gathers it into one terminal: the prints, the positions, the levels, the filings.
        </p>
        <div className="shrink-0">
          <Pill href="/signup" onClick={onSignUp} testId="hero">
            Sign up free
          </Pill>
        </div>
      </div>
      <div aria-hidden="true" className="flex-1" />
      {/* where less motion is asked for the window does not glide in under the hero: it stands beside the first room from the
          first frame and shows the room whose words are on screen, so there are no rooms here to choose for it */}
      {rooms.length > 0 && <HeroRooms rooms={rooms} at={at} onPick={onPick} line={line} />}
    </Wrap>
  );
};

/** THE ROOMS OVER THE WINDOW: each room on its glyph, bare; the lit one is in the window, and the hairline under it fills as
    its film plays. On a phone the row scrolls sideways and keeps the lit room in view without moving the page. */
const HeroRooms = ({ rooms, at, onPick, line }: { rooms: TourStep[]; at: number; onPick: (i: number) => void; line: (el: HTMLSpanElement | null) => void }) => {
  const row = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const r = row.current;
    const lit = r?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!r || !lit || r.scrollWidth <= r.clientWidth) return;
    r.scrollTo({ left: Math.max(0, lit.offsetLeft - (r.clientWidth - lit.offsetWidth) / 2), behavior: glideOrCut() });
  }, [at]);
  return (
    <div className="landing-rise [--rise-delay:220ms] mt-7 sm:mt-9 lg:mt-8">
      <div
        ref={row}
        role="group"
        aria-label="The rooms in the window"
        className="landing-rooms -mx-4 px-4 sm:mx-0 sm:px-0 flex items-center lg:justify-center gap-1 overflow-x-auto"
        data-hero-rooms
      >
        {rooms.map((r, i) => {
          const on = i === at;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(i)}
              aria-pressed={on}
              title={r.lead}
              className={`relative shrink-0 h-9 pl-2.5 pr-3.5 inline-flex items-center gap-2 rounded-full border text-[13.5px] font-medium whitespace-nowrap transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver ${
                on ? 'border-borderMuted bg-panel text-textPrimary' : 'border-transparent text-textMuted hover:text-textPrimary hover:bg-ink/[0.05]'
              }`}
              data-hero-room={r.id}
            >
              {r.glyph && <ProductGlyph name={r.glyph} size={17} bare className="shrink-0" />}
              {r.name}
              {/* how far through its film the lit room is: full, the next room lights */}
              {on && (
                <span
                  ref={line}
                  aria-hidden="true"
                  className="absolute left-3.5 right-3.5 -bottom-px h-[2px] origin-left rounded-full bg-silver"
                  style={{ transform: 'scaleX(0)' }}
                  data-hero-room-line
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* THE PLAN CARD (Slayer Logo System, Web and App · Pricing): the product's glyph, bare, and its name, the price, the
   product's one line, what the plan holds, and one door — "Choose Pinpoint" opens the account form with the plan named
   (pages/auth); Lifetime, on the mark, is "Talk to us". */
const PLAN_GLYPH: Record<PlanKey, 'pinpoint' | 'compass' | null> = { pinpoint: 'pinpoint', compass: 'compass', lifetime: null };

const Plan = ({ planKey, onChoose }: { planKey: PlanKey; onChoose: (key: PlanKey) => void }) => {
  const plan = PLANS.find(p => p.key === planKey)!;
  const holds = holdsOf(planKey);
  const custom = plan.monthly == null;
  const glyph = PLAN_GLYPH[planKey];
  return (
    /* A BIT SMALLER (Noah, 2026-09-20: "i think the pricing cards can be a bit smaller"): tight padding and rows, the price at
       52px. The price is still the biggest thing in the card. */
    <div className="flex flex-col py-7 lg:py-8 lg:px-8 first:lg:pl-0 last:lg:pr-0" data-landing-plan={planKey}>
      <div className="flex items-center gap-3">
        {glyph ? <ProductGlyph name={glyph} size={28} bare className="shrink-0" /> : <SlayerMark size={30} bare label="" />}
        <h3 className="text-[20px] font-medium tracking-tight">{plan.name}</h3>
      </div>
      {/* the page's big numbers are its prices — the only figures of ours it shows */}
      <p className="mt-6 flex items-baseline gap-2">
        <span className="text-[44px] sm:text-[52px] font-light leading-none tracking-[-0.045em] tnum">{plan.price}</span>
        {!custom && <span className="text-[15px] text-textMuted">{plan.period}</span>}
      </p>
      <p className="mt-4 text-[15px] leading-snug text-textSecondary max-w-[34ch]">{plan.kicker}</p>
      <ul className="mt-5 border-t border-borderSubtle">
        {holds.map(h => {
          const text = typeof h === 'string' ? h : h.text;
          const soon = typeof h !== 'string';
          return (
            <li key={text} className="py-2.5 border-b border-borderSubtle flex items-center justify-between gap-3 text-[13.5px] leading-snug text-textSecondary" data-plan-soon={soon || undefined}>
              <span>{text}</span>
              {/* an ORANGE CAPSULE (Noah, 2026-09-19): a solid pill in the house's orange — `warn` follows the ground, so it is a
                  visible orange on paper too; the dark word on it is the same on both (4.6:1 on paper, 9:1 on black) */}
              {soon && <span className="shrink-0 h-[22px] px-2.5 inline-flex items-center rounded-full bg-warn text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#0a0a0a]">Coming soon</span>}
            </li>
          );
        })}
      </ul>
      <div className="mt-7 lg:mt-auto lg:pt-7">
        {custom ? (
          /* the letter arrives saying which plan it is about — it went to the general inbox with nothing on it */
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

/** EVERY PLAN, SIDE BY SIDE (2026-10-01) — PLAN_ROWS read whole: a line on each row, a mark under each plan that holds it.
    Folded under its own door so the prices stay the end of the section for anyone who has seen enough. */
const PlansSideBySide = () => {
  const [open, setOpen] = useState(false);
  /* a reader that hears the table hears the words: a name on an svg without a role, or on a bare span, is not reliably read */
  const mark = (h: Holds) =>
    h === 'soon' ? (
      <span className="h-[20px] px-2 inline-flex items-center rounded-full bg-warn text-[9px] font-bold uppercase tracking-[0.14em] text-[#0a0a0a]">Soon</span>
    ) : h ? (
      <>
        <Check className="w-4 h-4 text-textPrimary" aria-hidden="true" />
        <span className="sr-only">Included</span>
      </>
    ) : (
      <>
        <span className="text-textMuted" aria-hidden="true">–</span>
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
        className="group inline-flex items-center gap-2 h-10 pl-4 pr-3.5 rounded-full border border-borderMuted text-[13.5px] font-medium text-textPrimary hover:border-textPrimary/70 hover:bg-ink/[0.06] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver"
        data-landing-side-by-side-door
      >
        {open ? 'Fold the plans away' : 'See the plans side by side'}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id="landing-plans-table" className="mt-6 overflow-x-auto animate-fade-in">
          {/* all three plans side by side on a phone too — narrow mark columns, the lines wrap (a sideways scroll showed one plan at a time) */}
          <table className="w-full min-w-[340px] border-collapse text-left">
            <caption className="sr-only">What each plan holds</caption>
            <thead>
              <tr className="border-b border-borderSubtle">
                <th scope="col" className="py-3 pr-3 sm:pr-4 align-bottom font-mono text-[11px] font-normal uppercase tracking-[0.22em] text-textMuted">What it holds</th>
                {PLANS.map(p => (
                  <th key={p.key} scope="col" className="py-3 px-1 sm:px-3 w-[64px] sm:w-[18%] text-center align-bottom">
                    <span className="block text-[13px] sm:text-[15px] font-medium text-textPrimary">{p.name}</span>
                    <span className="block text-[11px] sm:text-[12px] font-normal text-textMuted tnum">
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
                    <span className="flex items-center gap-2.5 text-[13px] sm:text-[14px] leading-snug text-textSecondary">
                      {r.glyph ? <ProductGlyph name={r.glyph} size={18} bare className="shrink-0" /> : <span className="w-[18px] shrink-0" aria-hidden="true" />}
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
  const { launch } = useLaunch();
  const [barGround, setBarGround] = useState<Ground>(a);
  const open = useCallback((path: string) => launch(path), [launch]);
  const navigate = useNavigate();
  /* a plan's door opens the account form with the plan named — the form is outside the terminal, so no gate */
  const choose = useCallback((key: PlanKey) => navigate(`/signup?plan=${key}`), [navigate]);

  /* "Sign up free": the account form, outside the terminal */
  const signUp = useCallback(() => navigate('/signup'), [navigate]);

  /* THE HERO'S ROOMS: which one is in the window, and whether the visitor picked it (then it stays). The window says when
     the room's page has been seen through — the next room lights, unless the visitor asked for less motion — and how far
     into it the film is, written straight to the lit room's line. */
  const calm = useReducedMotion();
  const [heroAt, setHeroAt] = useState(0);
  const [kept, setKept] = useState(false);
  const pickRoom = useCallback((i: number) => {
    setHeroAt(i);
    setKept(true);
  }, []);
  const heroNow = useRef({ path: HERO_ROOMS[0].path, plays: true });
  heroNow.current = { path: HERO_ROOMS[heroAt].path, plays: !kept && !calm };
  const heroLap = useCallback((seen: string) => {
    if (!heroNow.current.plays || seen !== heroNow.current.path) return;
    setHeroAt(i => (HERO_ROOMS[i].path === seen ? (i + 1) % HERO_ROOMS.length : i));
  }, []);
  const heroLine = useRef<HTMLSpanElement | null>(null);
  const heroLineAt = useRef(0);
  const setHeroLine = useCallback((el: HTMLSpanElement | null) => {
    if (el === heroLine.current) return;
    heroLine.current = el;
    heroLineAt.current = 0;
  }, []);
  const heroTime = useCallback((at: number, length: number, glide = 260) => {
    const el = heroLine.current;
    if (!el || !heroNow.current.plays) return;
    const p = Math.min(1, Math.max(0, at / length));
    /* a film wrapping round (or the line new) jumps back; forward, it glides from one reading to the next */
    el.style.transition = p < heroLineAt.current ? 'none' : `transform ${glide}ms linear`;
    el.style.transform = `scaleX(${p})`;
    heroLineAt.current = p;
  }, []);

  /* a link from elsewhere lands on /#pricing or /#faq (the not-found page suggests /#pricing) — go there once the page stands */
  useEffect(() => {
    if (!location.hash) return;
    const t = window.setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ block: 'start' }), 80);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="relative isolate min-h-screen overflow-x-clip font-sans" data-landing="v3">
      <a href="#tools" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-panel focus:text-textPrimary">
        Skip to the tools
      </a>
      <Nav ground={barGround} />

      {/* ── THE HERO AND THE TOUR: one ground, one live terminal ─────────────────────────── */}
      <Tour
        head={<Hero onSignUp={signUp} rooms={calm ? [] : HERO_ROOMS} at={heroAt} onPick={pickRoom} line={setHeroLine} />}
        steps={STEPS}
        first={HERO_ROOMS[heroAt].path}
        onOpen={open}
        onBarGround={setBarGround}
        endSays={[`${ROOMS} rooms.`, 'One terminal.']}
        onFirstLap={heroLap}
        onFirstTime={heroTime}
        firstNote={HERO_ROOMS[heroAt].lead}
      />

      {/* ── EVERYTHING IN IT: every page of every room, each a door (Everything.tsx) ─────────── */}
      <Block on="a" id="everything" label="Everything in it" className="pt-[14vh] pb-[12vh] scroll-mt-10">
        <Wrap>
          <div className="flex flex-col lg:flex-row lg:items-end gap-x-16 gap-y-6">
            <div>
              <Eyebrow>Everything in it</Eyebrow>
              <TwoTone className="mt-6" first="Every page, by room." second="Open any of them." />
            </div>
            <p className="lg:ml-auto max-w-[30rem] text-[16px] leading-relaxed text-textSecondary lg:pb-2" data-everything-count>
              {FEATURE_COUNT} pages and tools in {ROOM_COUNT} rooms, and {SHARED_COUNT} things every room shares. The rooms come round by themselves; pick one to stay on it. Each page opens in the terminal.
            </p>
          </div>
          <Everything onOpen={open} />
          <InPlaceOf />

          <div className="mt-[12vh] grid grid-cols-1 lg:grid-cols-12 gap-x-16 gap-y-12">
            <div className="lg:col-span-5">
              <Eyebrow>What you are paying for</Eyebrow>
              <TwoTone className="mt-6" first="A read." second="Never an instruction." />
            </div>
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
              <div>
                <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-textPrimary">It does</h3>
                <ul className="mt-4 border-t border-borderSubtle">
                  {IT_DOES.map(t => (
                    <li key={t} className="py-3.5 border-b border-borderSubtle text-[15px] leading-snug text-textPrimary">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-textMuted">It never</h3>
                <ul className="mt-4 border-t border-borderSubtle">
                  {IT_NEVER.map(t => (
                    <li key={t} className="py-3.5 border-b border-borderSubtle text-[15px] leading-snug text-textSecondary">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Wrap>
      </Block>

      {/* ── PRICING ──────────────────────────────────────────────────────────────────────── */}
      <Block on="a" id="pricing" label="Pricing" className="py-[12vh] scroll-mt-10">
        <Wrap>
          <Eyebrow>Pricing</Eyebrow>
          <div className="mt-6 flex flex-col lg:flex-row lg:items-end gap-x-16 gap-y-6">
            {/* the refund policy left this headline for the Questions, said kindly (Noah, 2026-09-19) */}
            <TwoTone first="Pick your plan." second="Cancel any time." />
            <p className="lg:ml-auto max-w-[30rem] text-[16px] leading-relaxed text-textSecondary lg:pb-2">
              {/* "Compass is everything" sat beside a plan that holds more (Lifetime), and Lifetime has nothing to cancel */}
              Pinpoint is the charts, the book and the tape. Compass is every desk. Cancel a monthly plan whenever you like and you keep your access until the period you paid for ends.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 border-y border-borderSubtle divide-y lg:divide-y-0 lg:divide-x divide-borderSubtle">
            {PLANS.map(p => (
              <Plan key={p.key} planKey={p.key} onChoose={choose} />
            ))}
          </div>
          <p className="mt-5 text-[13px] text-textMuted">Making an account is free. There are no refunds, so see what each plan holds first. Prices in US dollars.</p>

          {/* WHICH IS FOR ME — under each plan, in its column */}
          <div className="mt-14" data-landing-which>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-textMuted">Which is for me</h3>
            <ul className="mt-4 grid grid-cols-1 lg:grid-cols-3 border-t border-borderSubtle lg:divide-x divide-borderSubtle">
              {PLANS.map(p => (
                <li key={p.key} className="py-5 lg:px-8 first:lg:pl-0 last:lg:pr-0 border-b border-borderSubtle text-[15px] leading-snug">
                  <span className="font-medium text-textPrimary">{p.name}</span> <span className="text-textSecondary">{PLAN_FOR[p.key]}</span>
                </li>
              ))}
            </ul>
          </div>

          <PlansSideBySide />
        </Wrap>
      </Block>

      {/* ── THE QUESTIONS, THE LAST DOOR, THE FOOTER ─────────────────────────────────────── */}
      <Block on="a" id="faq" label="Questions" className="pt-[12vh] scroll-mt-10">
        <Wrap>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-16 gap-y-10">
            <div className="lg:col-span-5 lg:sticky lg:top-28 lg:self-start">
              <Eyebrow>Questions</Eyebrow>
              <TwoTone className="mt-6" first="Asked" second="before you buy." />
              {/* anything else goes to a person (2026-10-01) */}
              <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Pill href={`mailto:${COMPANY.info}`} kind="ghost" size="sm" testId="write">
                  {COMPANY.info}
                </Pill>
                <span className="text-[13px] text-textMuted">Anything else, ask. A person reads it.</span>
              </div>
            </div>
            <dl className="lg:col-span-7 border-t border-borderSubtle">
              {FAQ.map(f => (
                <div key={f.q} className="py-7 border-b border-borderSubtle" data-landing-faq>
                  <dt className="text-[19px] font-medium tracking-tight">{f.q}</dt>
                  <dd className="mt-2.5 max-w-[62ch] text-[15.5px] leading-relaxed text-textSecondary">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="py-[18vh] text-center">
            {/* THE ROOMS, ONCE MORE (2026-10-01): each glyph on its whole tile, a door into its room — 34, from 44 (2026-10-02, the
                owner: "make the logos a bit smaller") */}
            <ul className="mb-12 mx-auto max-w-[19rem] sm:max-w-none flex flex-wrap justify-center gap-3 sm:gap-4" aria-label="The rooms" data-landing-close-rooms>
              {HERO_ROOMS.map(r => (
                <li key={r.id}>
                  <a
                    href={r.path}
                    onClick={e => {
                      e.preventDefault();
                      open(r.path);
                    }}
                    aria-label={`Open ${r.name.replace(/^The /, 'the ')}`}
                    title={r.name}
                    className="block rounded-[14px] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-silver"
                    data-landing-close-room={r.id}
                  >
                    {r.glyph && <ProductGlyph name={r.glyph} size={34} bare className="max-sm:w-[30px] max-sm:h-[30px]" />}
                  </a>
                </li>
              ))}
            </ul>
            {/* Noah's pick from four (2026-09-19, of "Do not take our word for it. / Read it yourself.": "i dont like these 2
                sentences") — short and a little teasing, after a page of stills; read by scrolling since 2026-10-02 */}
            <LitLines
              lines={[
                { text: 'Seen enough?', ink: 'text-textPrimary' },
                { text: 'Step inside.', ink: 'text-textMuted' },
              ]}
              className="mx-auto font-light tracking-[-0.045em] leading-[0.96] text-[clamp(2.75rem,7.4vw,7rem)] [text-wrap:balance]"
            />
            <div className="mt-10 flex justify-center">
              <Pill href="/signup" onClick={signUp} testId="close">
                Sign up free
              </Pill>
            </div>
          </div>
        </Wrap>
        <SiteFooter home />
      </Block>
    </div>
  );
};

const Landing = () => (
  <GroundProvider>
    <Page />
  </GroundProvider>
);

export default Landing;
