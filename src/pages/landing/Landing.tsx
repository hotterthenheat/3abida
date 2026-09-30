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
  · The window says its data is simulated. The page
    says nothing about a feed's speed or source.
  · Phones first: the paid traffic arrives from X.
  · The prices are data/billing.ts's. WHAT EACH PLAN
    HOLDS below is Noah's to re-decide.
==================================================
*/

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowRight, Menu, Moon, Sun, X } from 'lucide-react';
import { PLANS, type PlanKey } from '../../data/billing';
import { useLaunch } from '../../components/layout/LaunchTransition';
import SiteFooter from '../../components/layout/SiteFooter';
import { Block, GroundProvider, useBlockGround, useGround, type Ground } from './ground';
import Tour, { type TourStep } from './Tour';

/** Where every door on the page leads. At launch this becomes the sign-up; today the terminal is open. */
const DOOR = '/pulse';
/** Flip at launch: the plan buttons turn from "try it first" into the checkout */
const CHECKOUT_OPEN = false;

const NAV: { label: string; href: string }[] = [
  { label: 'The tools', href: '#tools' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Questions', href: '#faq' },
];

/* THE TOUR. Every name, page and row here is a real one — the window opens it as the words arrive.
   THE ORDER IS NOAH'S (2026-09-20): Pulse · Compass · Terrain · Pinpoint, then the turn of the ground, then Trace · the
   Weigher · the Record. The codes are numbered off the order here, so moving a step is moving its block. */
const STEPS: TourStep[] = [
  {
    id: 'pulse',
    code: '01',
    kind: 'The desk',
    name: 'Pulse',
    lead: 'Your own desk of live panels.',
    rest: 'Add them, drag them, link them to one name or let each hold its own. It is kept the way you left it.',
    path: '/pulse',
    rows: [
      { title: 'The desk', says: 'The chart, the hedging at every strike and the book across the calendar, side by side.', path: '/pulse' },
      { title: 'Four charts', says: 'Four names at once, each with its own timeframe and overlays.', path: '/pulse/board' },
    ],
  },
  {
    id: 'compass',
    code: '02',
    kind: 'The contracts',
    name: 'Compass',
    lead: 'Option contracts picked off today’s levels.',
    rest: 'Every card is marked active, watch or fading, and the mark updates as price moves.',
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
    code: '05',
    kind: 'The tape',
    name: 'Trace',
    lead: 'Every print, as it happens.',
    rest: 'Options sweeps and blocks and dark-pool crosses, with the heaviest names and contracts kept at the side.',
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
    code: '06',
    kind: 'The scale',
    name: 'The Weigher',
    lead: 'Weigh any contract before you take it.',
    rest: 'The chart, the chain and your watchlist on one desk.',
    path: '/weigher',
    rows: [
      { title: 'The chain', says: 'Every strike and expiry for the name.' },
      { title: 'One list', says: 'The contracts you watch and the positions you hold, together.' },
      { title: 'The position card', says: 'What a position would return at every price, on a ruler.' },
    ],
  },
  {
    id: 'dossier',
    code: '07',
    kind: 'The file on a name',
    name: 'Dossier',
    lead: 'Everything on file about a name.',
    rest: 'The news, the earnings, the filings, and every stock on one screen.',
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
     'options backtesting'… because thats not something you see everyday"), and it still stands second, with FUTURES beside
     it (the same night: "i also want to have backtesting/paper trading for regular futures"). The brand above stays
     market-wide. Its pictures are the desks IN USE — the photographer starts an account or a session by the form's own
     doors, plays it forward and trades it (scripts/make-landing-shots.mjs). The lines were read against TradeZella
     ("Backtest your strategy in plain English", "replay it by hand, bar by bar"), Option Omega ("Backtest it. Automate
     it.") and ORATS ("Options Backtester") first: none of theirs are here. */
  {
    id: 'practice',
    code: '08',
    kind: 'Paper trading and backtesting',
    name: 'Practice',
    /* the headline leads with paper trading, as the room's first row does (Noah, 2026-09-26) */
    lead: 'Paper trade today’s prices, or replay a past day’s.',
    rest: 'A practice account or a prop firm’s evaluation on the live feed — options off the chain, futures long or short, the same order card and ladder as the desk, and nothing reaches a broker. Or a past day played back a minute at a time, the whole option chain with its bid and ask at every strike, so it can be traded in calls, puts and spreads with the decay in every price. One journal keeps every closed trade.',
    /* paper trading leads the room (Noah, 2026-09-26: "i want the paper trading live to be the first one") — its still
       is the options desk in use, not the start page (the photographer's `photo=1` window, embed.ts) */
    path: '/practice/paper',
    rows: [
      { title: 'Paper trading, live', says: 'A practice account or a prop firm’s evaluation on today’s prices — the same order card, chain and ladder, on the live feed.', path: '/practice/paper' },
      { title: 'Options, off the real chain', says: 'Pick any contract as it was quoted that minute. A same-day one loses value while you watch.', path: '/practice/backtest' },
      { title: 'Targets and stops that know decay', says: 'Set them on the contract’s price, or pin them to the stock’s. The chart shows where each one sits right now.' },
      { title: 'Futures, long or short', says: 'ES, NQ, oil, gold and silver, nearly round the clock, on margin. Every fill leans against you, never for you.', path: '/practice/futures' },
      { title: 'Your own rules', says: 'How many positions, what a trade may risk, where the day stops. A trade that breaks one is refused.' },
      { title: 'The journal', says: 'Every closed trade on its chart: what it did while you held it, your tags, your words.', path: '/practice/journal' },
    ],
  },
];

/** The tour's last words count its tools — "Seven rooms. One terminal." — off the list itself, so they cannot disagree with it */
const ROOMS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][STEPS.filter(s => s.code).length] ?? String(STEPS.filter(s => s.code).length);

const EVERY_ROOM: { title: string; says: string }[] = [
  { title: 'Alerts', says: 'Set one on any level, right where you are looking. It sounds on every page, and they all live in one drawer.' },
  { title: 'How to read', says: 'Every page has a guide behind it, written in plain English. Trading terms stay. Buzzwords do not.' },
  { title: 'Kept as you left it', says: 'Layouts, names and colours are remembered. Open it tomorrow and it is the desk you closed.' },
  { title: 'The keyboard', says: 'Every page and every action has a key, and one page lists them all.' },
];

const IT_DOES = [
  'Shows where dealer hedging sits, and redraws it as the day moves',
  'Reads a contract against that and says it in a word: strong, good, caution or poor',
  'Keeps a setup current: active while it holds, watch while it forms, fading when it breaks',
  'Explains every page in plain English',
];
const IT_NEVER = ['Tells you what to buy or sell', 'Places an order. It is not a broker', 'Boils a trade down to one number', 'Gives financial advice'];

/* WHAT EACH PLAN HOLDS — Noah's to re-decide (see the header). The prices come from data/billing.ts.
   A line marked `soon` is sold with the plan but not open yet, and says so: Community is one room behind
   the terminal's "coming soon" wall (Noah, 2026-09-19: it goes on the Compass plan, marked).
   REVIEW IS ON THE COMPASS PLAN (Noah, 2026-09-20: "review is in compass") — its line leads with the rare thing, as its
   room on the tour does. */
type Hold = string | { text: string; soon: true };
const PLAN_HOLDS: Record<PlanKey, { holds: Hold[]; featured?: boolean }> = {
  pinpoint: { holds: ['Pulse, your desk of live panels', 'Terrain, the levels on the chart', 'Pinpoint, the book by strike and by date', 'Trace, the tape and the dark pool', 'Alerts on any level'] },
  compass: { holds: ['Everything in Pinpoint', 'Compass, contracts that fit the levels', 'The Weigher, for any contract you name', 'The Record: news, earnings, insiders, Congress, stocks', 'Review, options backtesting with futures beside it', 'Your own scripts on the charts', { text: "Community, the traders' room", soon: true }], featured: true },
  lifetime: { holds: ['Everything in Compass, for good', 'One payment, nothing recurring', 'A one-to-one session to set up your desk', 'New tools before anyone else'] },
};

const FAQ: { q: string; a: string }[] = [
  { q: 'Are the pictures on this page real?', a: 'Yes. Every one is a picture of the terminal itself, taken from the real page, not a mock-up. The numbers in them are simulated data.' },
  { q: 'Does it tell me what to trade?', a: 'No. It shows where dealer hedging sits, and it reads a contract against that in a plain word: strong, good, caution or poor. What you do with that is yours. It is not a broker and it is not financial advice.' },
  { q: 'Do I need to be an expert?', a: 'No. Every page explains itself in plain English: what a wall is, why the flip matters, what dealers are forced to do at each level.' },
  { q: 'Can I get a refund?', a: 'We do not offer refunds, so please take your time and be sure before you subscribe. You can cancel whenever you like, and you keep your access until the end of the period you paid for. If a charge ever looks wrong, write to info@slayerterminal.com and a person will look into it.' },
  { q: 'How do I reach you?', a: 'info@slayerterminal.com. A person reads it.' },
];

/* ---- the pieces ---------------------------------------------------------------------------- */

const Wrap = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10 ${className}`}>{children}</div>;

/** A short rule and one small word — above every head on the page */
const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-textMuted">
    <span className="w-8 h-px bg-textMuted/60" aria-hidden="true" />
    {children}
  </p>
);

/** EVERY HEAD IS TWO LINES IN TWO TONES: what it is in ink, the turn of the thought in grey */
const TwoTone = ({ first, second, className = '' }: { first: string; second: string; className?: string }) => (
  <h2 className={`font-light tracking-[-0.04em] leading-[1.02] text-[40px] sm:text-[56px] lg:text-[72px] [text-wrap:balance] ${className}`}>
    {first} <span className="block text-textMuted">{second}</span>
  </h2>
);

/* THE DOOR'S ARROW GLIDES (Noah, 2026-09-20, on the plan buttons: "the middle ones arrow should be moving to the right smoothly in
   and out on hover… same with the launch terminal arrows"). One class for every door with an arrow: four pixels to the right
   under the pointer and back again on the same curve — the house's ease, so it leaves as smoothly as it arrives. A NAMED group
   (`group/door`): an unnamed one answers to any ancestor's hover too (the tour's rows are groups). */
const DOOR_GROUP = 'group/door';
const DOOR_ARROW = 'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/door:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/door:translate-x-0';

/** THE PILL. Solid: the silver foil on black, solid ink on paper (the foil is a surface, it would vanish there). Ghost: a hairline.
    NO GROWING UNDER THE POINTER (the same day: the two ghost pills "look laggy"): a 2% scale re-draws the words at a size
    between two pixel grids every frame, soft while it moves and snapping sharp at the end — that was the lag. The ghost
    answers with its edge and a wash, the solid with its arrow; only a press still gives (2%, 100ms). */
const Pill = ({ children, onClick, href, kind = 'solid', size = 'lg', testId }: { children: ReactNode; onClick?: () => void; href: string; kind?: 'solid' | 'ghost'; size?: 'lg' | 'sm'; testId?: string }) => {
  const ground = useBlockGround();
  const fill = kind === 'solid' ? (ground === 'dark' ? 'holo-bg text-[#0a0a0a]' : 'bg-textPrimary text-canvas') : 'border border-borderMuted text-textPrimary hover:border-textPrimary/70 hover:bg-ink/[0.06]';
  return (
    <a
      href={href}
      onClick={e => {
        if (!onClick) return;
        e.preventDefault();
        onClick();
      }}
      data-landing-door={testId}
      className={`${DOOR_GROUP} inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-[0.98] active:duration-100 motion-reduce:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-silver ${size === 'lg' ? 'h-12 pl-6 pr-5 text-[15px]' : 'h-9 pl-4 pr-3.5 text-[13px]'} ${fill}`}
    >
      {children}
      {kind === 'solid' && <ArrowRight className={`${size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${DOOR_ARROW}`} aria-hidden="true" />}
    </a>
  );
};

const toAnchor = (href: string) => {
  document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.replaceState(null, '', href);
};

/** THE BAR. Flat across the top of the page; once the page moves it lifts into a floating pill of
    glass. It wears the ground that is under it, so it turns when the page does. */
const Nav = ({ ground }: { ground: Ground }) => {
  const { a, flip } = useGround();
  const { launch } = useLaunch();
  const { scrollY } = useScroll();
  const [lifted, setLifted] = useState(false);
  useMotionValueEvent(scrollY, 'change', y => setLifted(y > 24));
  /* THE PHONE'S MENU (2026-09-19): under 768px the bar's three links were simply gone — a visitor on a phone, which is most
     of them, had no way to Pricing or the questions but to scroll for them. A button opens them as a small sheet under the
     bar, in the page's own grammar: rows on hairlines. It closes on a pick, on Escape, and on a tap outside it. */
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    const down = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('[data-landing-menu], [data-landing-menu-door]')) setMenu(false);
    };
    window.addEventListener('keydown', key);
    document.addEventListener('pointerdown', down, true);
    return () => {
      window.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', down, true);
    };
  }, [menu]);
  const glide = 'transition-[max-width,background-color,border-color,box-shadow,padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';
  return (
    <header data-theme={ground} className="fixed top-0 inset-x-0 z-40 flex justify-center px-3 sm:px-4 pt-2.5 sm:pt-3.5 pointer-events-none" data-landing-nav={ground} data-lifted={lifted || undefined}>
      <div
        className={`pointer-events-auto w-full h-[52px] flex items-center gap-2 sm:gap-4 rounded-full border ${glide} ${
          lifted ? 'max-w-[860px] pl-5 pr-1.5 border-borderSubtle bg-panel/75 backdrop-blur-xl shadow-[0_16px_50px_-20px_rgb(0_0_0/0.55)]' : 'max-w-[1408px] pl-1 sm:pl-2 lg:pl-6 pr-0 sm:pr-1 lg:pr-5 border-transparent bg-transparent'
        }`}
      >
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="font-mono text-[13px] font-bold tracking-tight whitespace-nowrap select-none text-textPrimary" aria-label="Slayer Terminal, back to the top">
          <span className="text-textMuted">&gt;_ </span>slayer_terminal
        </button>
        <nav className="hidden md:flex items-center gap-1 mx-auto" aria-label="On this page">
          {NAV.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={e => {
                e.preventDefault();
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
          className={`${DOOR_GROUP} h-10 pl-4 pr-3.5 inline-flex items-center gap-1.5 rounded-full text-[13.5px] font-medium whitespace-nowrap ${ground === 'dark' ? 'holo-bg text-[#0a0a0a]' : 'bg-textPrimary text-canvas'}`}
          data-landing-door="nav"
        >
          <span className="sm:hidden">Launch</span>
          <span className="hidden sm:inline">Launch terminal</span>
          <ArrowRight className={`w-3.5 h-3.5 ${DOOR_ARROW}`} aria-hidden="true" />
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
            className="md:hidden pointer-events-auto absolute top-[70px] inset-x-3 rounded-3xl border border-borderSubtle bg-panel/90 backdrop-blur-xl shadow-[0_24px_60px_-24px_rgb(0_0_0/0.6)] px-5 pt-1 pb-4"
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
                className="flex items-center justify-between h-[52px] border-b border-borderSubtle text-[17px] text-textPrimary"
              >
                {l.label}
                <ArrowRight className="w-4 h-4 text-textMuted" aria-hidden="true" />
              </a>
            ))}
            <a
              href={DOOR}
              onClick={e => {
                e.preventDefault();
                setMenu(false);
                launch(DOOR);
              }}
              className={`${DOOR_GROUP} mt-4 h-12 flex items-center justify-center gap-2 rounded-full text-[15px] font-medium ${ground === 'dark' ? 'holo-bg text-[#0a0a0a]' : 'bg-textPrimary text-canvas'}`}
              data-landing-door="menu"
            >
              Launch the terminal
              <ArrowRight className={`w-4 h-4 ${DOOR_ARROW}`} aria-hidden="true" />
            </a>
            <p className="mt-2.5 text-center font-mono text-[11px] text-textMuted">No sign-up. It opens on simulated data.</p>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
};

/* THE HEADLINE IS OURS (Noah, 2026-09-19). The first one — "Dealers have to hedge. See where." — turned out to sit a breath
   from a competitor's own hero ("Dealers have to hedge… exactly where they'll be forced to"): both were the first line anyone
   would write about this category. So the headline stopped leading with the dealers' obligation. Two of my replacements
   missed ("The options market." · "The market shows its work."); Noah then PICKED this one from four: "Trade what you can
   see." — short and blunt, in a trader's own voice, and true to a terminal that shows and never instructs.

   AND IT DOES NOT SAY "OPTIONS" (Noah, the same day: "we are going to expand to futures and other things so i dont think
   this options focused look is something we should go for"): the hero, the eyebrow, the paragraph and the footer's line speak
   of THE MARKET and of TRADERS. A tool's own words may still say options where that is what the tool reads today.

   THE MARKED WORD. The headline ends on one word over a soft bar, and the word changes letter by letter — the levels, the
   flow, the book, the record: what the terminal puts in front of you (Terrain's chart, Trace, Pinpoint, the Record), none of
   them a word that ties the brand to options. Still under reduced motion. */
const WORDS = ['levels.', 'flow.', 'book.', 'record.'];
const MarkedWord = () => {
  const calm = useReducedMotion();
  const ground = useBlockGround();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (calm) return;
    const t = window.setInterval(() => setI(v => (v + 1) % WORDS.length), 3400);
    return () => window.clearInterval(t);
  }, [calm]);
  const ink = ground === 'dark' ? 'holo-text' : 'text-silver';
  return (
    <span className="relative inline-block whitespace-nowrap" aria-hidden="true">
      {/* in the flow, unseen: it gives the line its width and its baseline */}
      <span className="invisible">{WORDS[i]}</span>
      <motion.span layout className="absolute left-0 right-0 bottom-[0.05em] h-[0.13em] rounded-full bg-silver/25" transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
      <AnimatePresence initial={false}>
        <motion.span key={i} className="absolute left-0 top-0" exit={{ opacity: 0, transition: { duration: 0.18 } }}>
          {WORDS[i].split('').map((ch, k) => (
            <motion.span
              key={k}
              /* EACH LETTER'S BOX IS WIDER THAN ITS LETTER (Noah, 2026-09-20: the "w" of "flow." cut off at its right edge — "actually
                 now that i am looking they all do"). The foil is a background clipped to the text, so it is painted ONLY inside
                 the letter's own box — and the headline's tight tracking (−0.045em) makes that box narrower than the glyph: the
                 ink that hangs past the box's edge has no foil behind it and its colour is transparent, so it is simply not
                 there. A "w" fills its whole advance, so it lost the most. The padding gives the foil room on both sides; the
                 equal negative margin takes the room back, so not one letter moves. */
              className={`inline-block px-[0.09em] -mx-[0.09em] ${ink}`}
              initial={{ y: '0.28em', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.16 + k * 0.035, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const Hero = ({ onLaunch }: { onLaunch: () => void }) => (
  <Wrap className="pt-[120px] sm:pt-[136px] pb-10 sm:pb-14">
    <Eyebrow>For traders</Eyebrow>
    <h1 aria-label="Trade what you can see. See the levels, the flow, the book and the record." className="mt-6 font-light tracking-[-0.045em] leading-[0.94] text-[clamp(3.1rem,8.2vw,8rem)]">
      <span aria-hidden="true">Trade what you can see.</span>
      <span className="block" aria-hidden="true">
        <span className="text-textMuted">See the </span>
        <MarkedWord />
      </span>
    </h1>
    <div className="mt-8 sm:mt-10 flex flex-col lg:flex-row lg:items-end gap-x-16 gap-y-8">
      <p className="max-w-[35rem] text-[17px] sm:text-[18px] leading-[1.55] text-textSecondary">
        Most of what moves a price is public, just scattered. Slayer gathers it into one terminal: the prints, the positions, the levels, the filings. Every page explains itself in plain English.
      </p>
      <div className="lg:ml-auto flex flex-col items-start lg:items-end gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Pill href={DOOR} onClick={onLaunch} testId="hero">
            Launch the terminal
          </Pill>
          <Pill href="#tools" onClick={() => toAnchor('#tools')} kind="ghost">
            See the tools
          </Pill>
        </div>
        <p className="font-mono text-[11px] text-textMuted">No sign-up. It opens on simulated data.</p>
      </div>
    </div>
  </Wrap>
);

const Plan = ({ planKey, onTry }: { planKey: PlanKey; onTry: () => void }) => {
  const plan = PLANS.find(p => p.key === planKey)!;
  const { holds, featured } = PLAN_HOLDS[planKey];
  const custom = plan.monthly == null;
  return (
    /* A BIT SMALLER (Noah, 2026-09-20: "i think the pricing cards can be a bit smaller"): the same three columns on the same rules, about a
       fifth shorter — tighter padding and rows, the price at 52px, not 76. The price is still the biggest thing in the card. */
    <div className="flex flex-col py-7 lg:py-8 lg:px-8 first:lg:pl-0 last:lg:pr-0" data-landing-plan={planKey}>
      <div className="flex items-center gap-2.5">
        <h3 className="text-[19px] font-medium tracking-tight">{plan.name}</h3>
        {featured && <span className="h-5 px-2 inline-flex items-center rounded-full bg-textPrimary text-canvas font-mono text-[9px] font-bold uppercase tracking-widest">All of it</span>}
      </div>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">{plan.kicker}</p>
      {/* the page's big numbers are its prices — the only figures of ours it shows */}
      <p className="mt-5 flex items-baseline gap-2">
        <span className="text-[44px] sm:text-[52px] font-light leading-none tracking-[-0.045em] tnum">{plan.price}</span>
        <span className="font-mono text-[11px] text-textMuted">{plan.period}</span>
      </p>
      <ul className="mt-6 border-t border-borderSubtle">
        {holds.map(h => {
          const text = typeof h === 'string' ? h : h.text;
          const soon = typeof h !== 'string';
          return (
            <li key={text} className="py-2.5 border-b border-borderSubtle flex items-center justify-between gap-3 text-[13.5px] leading-snug text-textSecondary" data-plan-soon={soon || undefined}>
              <span>{text}</span>
              {/* an ORANGE CAPSULE (Noah, 2026-09-19): a solid pill, the Map's capsules' shape, in the house's orange — `warn` follows the ground,
                  so it is a visible orange on paper too; the dark word on it is the same on both (4.6:1 on paper, 9:1 on black) */}
              {soon && <span className="shrink-0 h-[22px] px-2.5 inline-flex items-center rounded-full bg-warn font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#0a0a0a]">Coming soon</span>}
            </li>
          );
        })}
      </ul>
      <div className="mt-7 lg:mt-auto lg:pt-7">
        {custom ? (
          <Pill href="mailto:info@slayerterminal.com" kind="ghost">
            Talk to us
          </Pill>
        ) : (
          <Pill href={DOOR} onClick={onTry} kind={featured ? 'solid' : 'ghost'} testId={`plan-${planKey}`}>
            {CHECKOUT_OPEN ? `Choose ${plan.name}` : 'Try it first'}
          </Pill>
        )}
      </div>
    </div>
  );
};

/* ---- the page ------------------------------------------------------------------------------ */

const Page = () => {
  const { a } = useGround();
  const { launch } = useLaunch();
  const [barGround, setBarGround] = useState<Ground>(a);
  const open = useCallback((path: string) => launch(path), [launch]);
  const door = useCallback(() => launch(DOOR), [launch]);

  /* a footer link from inside the terminal lands on /#pricing or /#faq — go there once the page stands */
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
      <Tour head={<Hero onLaunch={door} />} steps={STEPS} first={DOOR} onOpen={open} onBarGround={setBarGround} endSays={[`${ROOMS} rooms.`, 'One terminal.']} />

      {/* ── IN EVERY ROOM ────────────────────────────────────────────────────────────────── */}
      <Block on="a" id="more" label="In every room" className="pt-[14vh] pb-[12vh]">
        <Wrap>
          <Eyebrow>In every room</Eyebrow>
          <TwoTone className="mt-6" first="The small things." second="Done properly." />
          <dl className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-borderSubtle lg:divide-x lg:divide-borderSubtle">
            {EVERY_ROOM.map(r => (
              <div key={r.title} className="py-8 lg:px-8 first:lg:pl-0 last:lg:pr-0 border-b border-borderSubtle lg:border-b-0" data-landing-room={r.title}>
                <dt className="text-[19px] font-medium tracking-tight">{r.title}</dt>
                <dd className="mt-2.5 text-[14.5px] leading-relaxed text-textSecondary">{r.says}</dd>
              </div>
            ))}
          </dl>

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
              Pinpoint is the charts, the book and the tape. Compass is everything. Cancel whenever you like and you keep your access until the period you paid for ends.
              {!CHECKOUT_OPEN && ' Payments open at launch.'}
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 border-y border-borderSubtle divide-y lg:divide-y-0 lg:divide-x divide-borderSubtle">
            {PLANS.map(p => (
              <Plan key={p.key} planKey={p.key} onTry={door} />
            ))}
          </div>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-textMuted">Prices in US dollars</p>
        </Wrap>
      </Block>

      {/* ── THE QUESTIONS, THE LAST DOOR, THE FOOTER ─────────────────────────────────────── */}
      <Block on="a" id="faq" label="Questions" className="pt-[12vh] scroll-mt-10">
        <Wrap>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-16 gap-y-10">
            <div className="lg:col-span-5 lg:sticky lg:top-28 lg:self-start">
              <Eyebrow>Questions</Eyebrow>
              <TwoTone className="mt-6" first="Asked" second="before you buy." />
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
            <h2 className="mx-auto font-light tracking-[-0.045em] leading-[0.96] text-[clamp(2.75rem,7.4vw,7rem)] [text-wrap:balance]">
              {/* Noah's pick from four (2026-09-19, of "Do not take our word for it. / Read it yourself.": "i dont like these 2
                  sentences") — short and a little teasing, after a page of stills */}
              Seen enough? <span className="block text-textMuted">Step inside.</span>
            </h2>
            <div className="mt-10 flex justify-center">
              <Pill href={DOOR} onClick={door} testId="close">
                Launch the terminal
              </Pill>
            </div>
            <p className="mt-4 font-mono text-[11px] text-textMuted">No sign-up. It opens on simulated data.</p>
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
