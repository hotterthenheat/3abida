/*
==================================================
  SLAYER TERMINAL - LANDING (/) · v4

  REBUILT FROM THE GROUND UP (2026-10-03 — the owner's
  brief: "SHOW THE PRODUCT. DO NOT EXPLAIN THE ENTIRE
  PRODUCT." The visitor understands what Slayer is in
  five seconds, why it matters in fifteen, and sees
  enough of the real terminal to want in; "I understand
  what this is, but I still need to see inside").

  ONE QUESTION A SECTION, IN THE ORDER A VISITOR ASKS:
    What is this?          the hero — the line, two
                           doors, and the terminal itself
    Why does it matter?    one statement
    Show me.               ONE SESSION, AS THE TERMINAL
                           SAW IT (Session.tsx): five
                           moments of one run, the scroll
                           playing the session between
    What else can it see?  the four systems — Compass,
                           Pinpoint, Terrain, Trace — a
                           name, one line, the real page
                           filling the width, a small door
    Can I trust it?        four principles, and what is
                           observed, calculated and
                           modeled (what the engine
                           produces — never how)
    How much is it?        three plans: who each is for and
                           the one difference, the full
                           list folded under them
    Let me in.             the questions a buyer asks, then
                           "See the market. Then trade it."

  GONE WITH v3: the tour of eight rooms and its turning
  ground, "Everything in it" (every page of every room —
  a documentation index, the brief's own words), the
  products menu of every page, the hero's row of rooms.
  The terminal keeps its architecture inside; the page
  shows what it can see.

  THE PICTURES ARE THE TERMINAL ITSELF (Noah, 2026-09-19:
  "i want the REAL thing from our website so it doesnt
  scream fake"): every window plays a film of the real
  page in use (scripts/make-landing-clips.mjs), the
  session is the real desk run forward
  (scripts/make-landing-session.mjs). Nothing is drawn to
  look like the product.

  THE RULES IT KEEPS: no reviews, ratings, member counts,
  results or performance of any kind (we have none); no
  grade, score, win rate, signal, guaranteed, confluence
  or market intelligence; never "simulated", "demo",
  "fake", "preview" or "at launch"; "Sign up free" is
  the door (an account is free; there is no trial). No
  refunds is said kindly, in the questions. The prices
  are data/billing.ts's; what each plan holds is
  PLAN_ROWS's.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Menu, Moon, Sun, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLANS, type PlanKey } from '../../data/billing';
import { COMPANY } from '../../data/company';
import { useLaunch } from '../../components/layout/LaunchTransition';
import SiteFooter from '../../components/layout/SiteFooter';
import { useIsBelowLg } from '../../components/ui/useMediaQuery';
import { Block, GroundProvider, useBlockGround, useGround, type Ground } from './ground';
import TerminalWindow, { savingData, warmOtherGround } from './TerminalWindow';
import { warmShell } from '../../components/layout/shell';
import type { Sweep } from './Boot';
import { PRODUCTS } from '../../brand/products';
import Session, { type Story as StoryHold } from './Session';
import Scatter from './Scatter';
import SlayerMark from '../../brand/SlayerMark';
import Wordmark from '../../brand/Wordmark';
import ProductGlyph from '../../brand/ProductGlyph';
import type { GlyphName } from '../../brand/paths';

/** Where "Launch terminal" opens the terminal: the desk an account lands on */
const DOOR = '/pulse';

/** THE BAR'S WORDS: this page's own sections */
const NAV: { label: string; href: string }[] = [
  { label: 'How it works', href: '#how' },
  { label: 'Products', href: '#products' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Questions', href: '#faq' },
];

/* THE HERO'S PICTURE — the desk an account lands on, in use (its film: scripts/make-landing-clips.mjs reads every `path`
   on this page) */
const HERO = {
  path: '/pulse',
};

/* THE FOUR SYSTEMS (the owner's brief: "Feature four systems prominently … Name → one sentence → real product → small
   CTA"). Each line says what its film shows — the page as it opens (2026-10-03, read against the terminal: Compass is the
   board of contracts that fit the levels, not a read of the market's condition; that read is Pinpoint's head). On one
   stage (Systems, below), each page boots into the window in a motion drawn from what the page does (Boot.tsx `sweep`):
   a card dealt, the book opening from the price, the chart drawn left to right, the tape printing down. */
interface System {
  id: string;
  code: string;
  glyph: GlyphName;
  name: string;
  line: string;
  says: string;
  path: string;
  sweep: Sweep;
}
const SYSTEMS: System[] = [
  {
    id: 'compass',
    code: '01',
    glyph: 'compass',
    name: 'Compass',
    line: 'Know which contracts fit the market right now.',
    says: 'Compass sweeps the option chains against today’s levels and ranks the setups that clear the bar. Every card says where its setup stands — watch, active, moving or fading — and changes as price does.',
    path: '/compass',
    sweep: 'deal',
  },
  {
    id: 'pinpoint',
    code: '02',
    glyph: 'pinpoint',
    name: 'Pinpoint',
    line: 'See where positioning concentrates.',
    says: 'The options book by strike and by expiry, in five greeks: where dealer hedging is heaviest, where it flips from absorbing moves to amplifying them, and how each level has held today.',
    path: '/pinpoint/map',
    sweep: 'out',
  },
  {
    id: 'terrain',
    code: '03',
    glyph: 'terrain',
    name: 'Terrain',
    line: 'See positioning across price.',
    says: 'Charts with the book drawn on the candles — the exposure at every strike, through the day — and a rail of the heaviest strikes beside each one. Up to four names side by side.',
    path: '/terrain',
    sweep: 'right',
  },
  {
    id: 'trace',
    code: '04',
    glyph: 'trace',
    name: 'Trace',
    line: 'Follow what is actually trading.',
    says: 'Every options print as it crosses: the contract, the fill against the market, size against open interest, the premium and its side. The head of the tape names the top bull, the top bear and the largest print.',
    path: '/trace/live-tape',
    sweep: 'down',
  },
];

/* WHY SLAYER — four principles, said plainly (the brief: "establish that Slayer is serious without sounding like
   corporate marketing") */
const PRINCIPLES: { title: string; says: string }[] = [
  { title: 'Real data', says: 'Every figure starts from the market’s own record: trades, quotes, open interest and filings.' },
  { title: 'Deterministic calculations', says: 'Fixed rules, not guesses. The same market gives the same read, every time.' },
  { title: 'Transparent provenance', says: 'Every number is observed, calculated or modeled, and the Data page names which is which.' },
  { title: 'No black-box promises', says: 'No predictions and no outcomes promised. It shows the market; the call is yours.' },
];

/* WHAT IT PRODUCES, NEVER HOW (the brief: "Recipe stays private. Result is visible" — no formula, weighting, threshold or
   assumption that would let the engine be rebuilt). The kinds are /legal/data's, in three. */
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

/* THE QUESTIONS A BUYER ASKS (the brief's list, kept to purchase objections — not product documentation). No refunds,
   said kindly, here and never as a banner. */
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
    q: 'What does each system do?',
    a: 'Compass picks contracts that fit today’s levels. Pinpoint shows where positioning concentrates and where hedging flips. Terrain draws that positioning on the chart. Trace follows every print as it crosses. Pulse puts any of them on one desk.',
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

/** ONE SMALL WORD OVER A SHORT BAR — above every head on the page, the Logo System's section label */
const Eyebrow = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col items-start gap-2.5">
    <p className="text-[13px] text-textMuted">{children}</p>
    <span className="w-10 h-[3px] rounded-full bg-silver" aria-hidden="true" />
  </div>
);

/** EVERY HEAD IS TWO LINES IN TWO TONES: what it is in ink, the turn of the thought in grey */
const TwoTone = ({ first, second, className = '' }: { first: string; second: string; className?: string }) => (
  /* outline-none: a jump along the page lands the keys here (toAnchor) — a heading to land on, not a control */
  <h2 className={`font-light tracking-[-0.04em] leading-[1.02] text-[32px] sm:text-[42px] lg:text-[50px] [text-wrap:balance] outline-none ${className}`}>
    {first} <span className="block text-textMuted">{second}</span>
  </h2>
);

/** A SECTION'S HEAD: its word over a bar, its two-tone line and, beside it, a line of what follows — arriving a line at a
    time as it is first seen, the two-tone line coming into focus as the hero's headline does (index.css .landing-settle) */
const Head = ({ eyebrow, first, second, aside }: { eyebrow: string; first: string; second: string; aside?: ReactNode }) => {
  const ref = useArrival<HTMLDivElement>();
  return (
    <div ref={ref} className="landing-lines grid grid-cols-1 lg:grid-cols-12 gap-x-16 gap-y-6 lg:items-end">
      <div className="lg:col-span-7">
        <div className="landing-line [--i:0]">
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <div className="landing-line landing-settle [--i:1]">
          <TwoTone className="mt-6" first={first} second={second} />
        </div>
      </div>
      {aside && <p className="landing-line [--i:2] lg:col-span-5 max-w-[30rem] text-[16px] leading-relaxed text-textSecondary lg:pb-2">{aside}</p>}
    </div>
  );
};

/** THE FOIL'S WORD: "see." on the hero — the foil on black, the steel ink on paper (THE FOIL TRAP, ground.tsx) */
const Foil = ({ children }: { children: ReactNode }) => {
  const ground = useBlockGround();
  /* the foil's letters get room past their box (the headline's tight tracking would cut the "e"'s overhang — 2026-09-20) */
  return <span className={`font-medium inline-block px-[0.06em] -mx-[0.06em] ${ground === 'dark' ? 'holo-text' : 'text-silver'}`}>{children}</span>;
};

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
    and the foil stays on "Launch terminal" alone; ghost is a hairline. NO GROWING UNDER THE POINTER (2026-09-20: "look
    laggy"): the ghost answers with its edge and a wash, the solid with a breath of its own ink; only a press gives. */
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

/** A SMALL DOOR WITH AN ARROW: the words and an arrow that glides under the pointer */
const Door = ({ children, onClick, href, testId }: { children: ReactNode; onClick: () => void; href: string; testId?: string }) => (
  <a
    href={href}
    onClick={e => {
      e.preventDefault();
      onClick();
    }}
    className="group/door inline-flex items-center gap-2 h-10 pl-4 pr-3.5 rounded-full border border-borderMuted text-[13.5px] font-medium text-textPrimary hover:border-textPrimary/70 hover:bg-ink/[0.06] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver"
    data-landing-door={testId}
  >
    {children}
    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/door:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
  </a>
);

/** A jump along the page glides — unless the visitor asked their system for less motion: then it is a cut */
const glideOrCut = (): ScrollBehavior => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/* A JUMP ALONG THE PAGE LEAVES A WAY BACK (2026-10-03 audit): the jump is a step in the history, and Back returns the
   reader to where they jumped from. AND IT TAKES THE KEYS WITH IT: the section's head takes the focus, quietly, so the next
   Tab goes on inside the section. */
const toAnchor = (href: string) => {
  if (location.hash !== href) history.pushState(null, '', href);
  const to = document.querySelector<HTMLElement>(href);
  if (!to) return;
  to.scrollIntoView({ behavior: glideOrCut(), block: 'start' });
  const head = to.querySelector<HTMLElement>('h2') ?? to;
  if (!head.hasAttribute('tabindex')) head.setAttribute('tabindex', '-1');
  head.focus({ preventScroll: true });
};

/** ONE ARRIVAL, ONCE: a block that comes in as it is first seen — a line reveal for words (the Logo System's text reveal:
    line by line, 40 ms apart), a clip drawn from what the page does for a window. Nothing where less motion is asked for,
    and nothing hidden before the script has run (the waiting state is set by it). */
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

/** THE BAR. Flat across the top of the page with the wordmark; once the page moves it lifts into a floating pill and the
    wordmark gives way to the mark (the Logo System's own two frames). The pill is solid panel, not glass (the brief of
    2026-10-03: "No glassmorphism"). */
const Nav = ({ ground }: { ground: Ground }) => {
  const { choose } = useGround();
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
  /* "Holographic silver · in the S and on Launch terminal only" — the foil on black, the ink on paper */
  const launchFill = ground === 'dark' ? 'holo-bg text-[#0a0a0a]' : 'bg-textPrimary text-canvas';
  return (
    <header data-theme={ground} className="fixed top-0 inset-x-0 z-40 flex justify-center px-3 sm:px-4 pt-2.5 sm:pt-3.5 pointer-events-none" data-landing-nav={ground} data-lifted={lifted || undefined}>
      <div
        className={`pointer-events-auto relative w-full h-[52px] flex items-center gap-2 sm:gap-4 rounded-full border ${glide} ${
          lifted ? 'max-w-[760px] pl-2.5 pr-1.5 border-borderSubtle bg-panel shadow-[0_16px_50px_-20px_rgb(0_0_0/0.55)]' : 'max-w-[calc(var(--landing-col)_-_32px)] pl-1 sm:pl-2 lg:pl-6 pr-0 sm:pr-1 lg:pr-5 border-transparent bg-transparent'
        }`}
      >
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: glideOrCut() })} className="shrink-0 inline-flex items-center select-none rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver" aria-label="Slayer Terminal, back to the top" data-landing-brand>
          {/* the wordmark on the open bar, the mark on the lifted pill and on a phone */}
          <span className={lifted ? 'hidden' : 'hidden sm:inline-flex'}>
            <Wordmark height={15} cursor label="" />
          </span>
          <span className={lifted ? 'inline-flex' : 'sm:hidden inline-flex'}>
            <SlayerMark size={26} bare near label="" />
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
              className="h-8 px-3.5 inline-flex items-center rounded-full text-[13.5px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver whitespace-nowrap"
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
          className={`h-10 px-4 sm:px-5 inline-flex items-center rounded-full text-[13.5px] font-medium whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver ${launchFill}`}
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
            className="md:hidden pointer-events-auto absolute top-[70px] inset-x-3 max-h-[calc(100svh-90px)] overflow-y-auto overscroll-contain rounded-3xl border border-borderSubtle bg-panel shadow-[0_24px_60px_-24px_rgb(0_0_0/0.6)] px-5 pt-1"
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
            <div className="pt-3 pb-4">
              <a
                href="/signup"
                onClick={e => {
                  e.preventDefault();
                  setMenu(false);
                  navigate('/signup');
                }}
                className="h-12 flex items-center justify-center rounded-full text-[15px] font-medium bg-textPrimary text-panel"
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

/* WHAT IS THIS? — THE HERO (the brief: "The first screen must immediately show the real Slayer Terminal … The terminal
   visual should be the centerpiece"). The name, the line the brand keeps ("Trade what you can see." — Noah's pick of four,
   2026-09-19; it speaks of the market and of traders, not of options), one line of what it brings together, the door and
   the way to see it work, and under them the terminal itself: the desk an account lands on, in use, as large as the
   column — on a laptop it runs past the fold, so the first screen is the words and the terminal's top, and a scroll shows
   it whole. Under it, said once, what the picture is. */
const Hero = ({ onSignUp }: { onSignUp: () => void }) => {
  const ground = useBlockGround();
  const small = useIsBelowLg();
  return (
    <Wrap className="pt-[100px] sm:pt-[116px] lg:pt-[128px]" data-landing-hero>
      <p className="landing-rise text-[12px] font-medium uppercase tracking-[0.26em] text-textMuted">Slayer Terminal</p>
      <h1 className="landing-rise landing-focus [--rise-delay:60ms] mt-5 sm:mt-6 font-light tracking-[-0.045em] leading-[0.96] text-[clamp(2.6rem,min(5.6vw,10svh),5.25rem)] [text-wrap:balance]" data-landing-headline>
        Trade what you can <Foil>see.</Foil>
      </h1>
      <p className="landing-rise [--rise-delay:120ms] mt-5 max-w-[40rem] text-[16px] sm:text-[18px] leading-[1.5] text-textSecondary [text-wrap:balance]" data-landing-hero-sub>
        Positioning, market structure, volatility and flow — brought together in one terminal.
      </p>
      <div className="landing-rise [--rise-delay:170ms] mt-7 flex flex-wrap items-center gap-3" data-landing-hero-doors>
        <Pill href="/signup" onClick={onSignUp} testId="hero">
          Sign up free
        </Pill>
        <Pill href="#how" onClick={() => toAnchor('#how')} kind="ghost" testId="how">
          See how it works
        </Pill>
      </div>
      <figure className="landing-rise [--rise-delay:260ms] [--rise-from:28px] mt-10 sm:mt-12 lg:mt-14" data-landing-hero-window>
        <TerminalWindow path={HERO.path} theme={ground} desk={!small} natural boot="hero" />
        <figcaption className="mt-4 text-[13px] text-textMuted">The terminal itself, in use — played three times as fast.</figcaption>
      </figure>
    </Wrap>
  );
};

/** WHY DOES IT MATTER? — one statement, said once */
const Matters = () => {
  const ref = useArrival<HTMLDivElement>();
  return (
    <Wrap className="py-[14vh] lg:py-[17vh]">
      <div ref={ref} className="landing-lines max-w-[920px]">
        <h2 className="landing-line [--i:0] font-light tracking-[-0.045em] leading-[1.0] text-[34px] sm:text-[48px] lg:text-[64px] [text-wrap:balance]">
          Most of what moves a price is public. <span className="block text-textMuted">It’s just scattered.</span>
        </h2>
        <p className="landing-line [--i:2] mt-7 lg:mt-8 max-w-[40rem] text-[17px] sm:text-[18px] leading-[1.5] text-textSecondary">
          Where the options positions sit, where hedging flips, what is trading right now. Slayer reads them together, on one screen, while the session moves.
        </p>
      </div>
    </Wrap>
  );
};

/** WHAT THE SESSION SAYS FIRST, beside its window as the desk's parts land in it (the scatter's payoff and the session's
    head in one) */
const Lead = () => (
  <div>
    <Eyebrow>How it works</Eyebrow>
    <h2 className="mt-6 font-light tracking-[-0.035em] leading-[1.04] text-[30px] xl:text-[34px] [text-wrap:balance] outline-none">
      Slayer reads them together, <span className="block text-textMuted">on one screen, while the session moves.</span>
    </h2>
    <p className="mt-5 max-w-[34ch] text-[15px] leading-[1.55] text-textSecondary">
      Five moments from one session on SPY, each read off the terminal as it ran. Scroll, and the session plays between them.
    </p>
  </div>
);

/* WHY DOES IT MATTER? AND SHOW ME — ONE STORY, ON A DESK (2026-10-03 — the landing showed the same desk three times, and
   the four products eight screens down): the desk's parts lie scattered round "Most of what moves a price is public. It's
   just scattered.", gather into the session's own window as the reader scrolls (Scatter.tsx), and that window then plays
   the session beside its beats (Session.tsx). A phone and less motion have the words alone, then the session's head and
   beats (Page). */
const Story = ({ theme }: { theme: Ground }) => {
  const stage = useRef<HTMLDivElement | null>(null);
  const screen = useRef<HTMLDivElement | null>(null);
  const intro = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  const targets = useMemo(() => ({ stage, screen, intro }), []);
  const hold = useMemo<StoryHold>(() => ({ ...targets, shown, lead: <Lead /> }), [targets, shown]);
  return (
    <div className="relative" data-story>
      <Scatter theme={theme} story={targets} onLanded={setShown} />
      <Wrap className="relative">
        <Session theme={theme} story={hold} />
      </Wrap>
    </div>
  );
};

/* WHAT ELSE CAN IT SEE? — THE FOUR SYSTEMS ON ONE STAGE (2026-10-03 — the owner: "information and hiecrcy wise i still
   feel as if were missing that wow"; four blocks alike, one under another, read as one block four times). A player and
   its list: the window on one side, the four on the other — each its number, glyph, name and line; the one on screen
   bright, with what it does and its door under the list. The window boots into each page from the footer's broken pixels,
   along the page's own motion (Boot.tsx `sweep`), and holds its film on the first frame until it has. THE STAGE PLAYS
   ITSELF while it is on screen and the tab is in front, a page every DWELL, a silver line filling under the one on screen;
   a pointer moving over the stage holds it until it has been still a while, the keys inside hold it, a touch holds it a
   while after the finger lifts, and a pick holds it until the stage has left the screen. Where less motion is asked for
   it stands still and changes only when asked, at once. */
const DWELL = 6500;
const STILL_FOR = 2500;

/** what the system on screen does, and its door */
const Does = ({ s, onOpen }: { s: System; onOpen: (path: string) => void }) => (
  <div key={s.id} className="mt-5 lg:mt-8 lg:pt-6 lg:border-t lg:border-borderSubtle animate-fade-in">
    <p className="max-w-[36rem] text-[15px] leading-[1.55] text-textSecondary">{s.says}</p>
    <div className="mt-5">
      <Door href={s.path} onClick={() => onOpen(s.path)} testId={`system-${s.id}`}>
        Open {s.name}
      </Door>
    </div>
  </div>
);

const Systems = ({ onOpen }: { onOpen: (path: string) => void }) => {
  const ground = useBlockGround();
  const small = useIsBelowLg();
  const calm = useReducedMotion();
  const [at, setAt] = useState(0);
  const stage = useRef<HTMLDivElement | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const bar = useRef<HTMLSpanElement | null>(null);
  /* what holds the stage: a pick (until it leaves the screen), the keys inside it, a pointer moving over it, a touch */
  const picked = useRef(false);
  const keys = useRef(false);
  const until = useRef(0);
  const atRef = useRef(at);
  atRef.current = at;
  const elapsed = useRef(0);
  const choose = useCallback((i: number) => {
    elapsed.current = 0;
    setAt(i);
  }, []);
  useEffect(() => {
    elapsed.current = 0;
  }, [at]);
  useEffect(() => {
    const el = stage.current;
    if (!el || calm) return;
    let raf = 0;
    let last = 0;
    let seen = false;
    const io = new IntersectionObserver(
      ([e]) => {
        seen = e.isIntersecting;
        if (!seen) picked.current = false;
        if (seen && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.35 }
    );
    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(100, now - last);
      last = now;
      const holding = picked.current || keys.current || now < until.current || document.visibilityState !== 'visible';
      if (!holding) elapsed.current += dt;
      if (elapsed.current >= DWELL) {
        elapsed.current = 0;
        setAt(i => (i + 1) % SYSTEMS.length);
      }
      if (bar.current) bar.current.style.transform = `scaleX(${picked.current ? 1 : Math.min(1, elapsed.current / DWELL)})`;
      if (seen) raf = requestAnimationFrame(tick);
    };
    const moved = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      until.current = performance.now() + STILL_FOR;
    };
    const touched = () => {
      until.current = Number.POSITIVE_INFINITY;
    };
    const lifted = () => {
      until.current = performance.now() + 3000;
    };
    const focusIn = (e: FocusEvent) => {
      if ((e.target as HTMLElement)?.matches?.(':focus-visible')) keys.current = true;
    };
    const focusOut = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) keys.current = false;
    };
    io.observe(el);
    el.addEventListener('pointermove', moved);
    el.addEventListener('pointerdown', touched);
    el.addEventListener('pointerup', lifted);
    el.addEventListener('pointercancel', lifted);
    el.addEventListener('focusin', focusIn);
    el.addEventListener('focusout', focusOut);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', moved);
      el.removeEventListener('pointerdown', touched);
      el.removeEventListener('pointerup', lifted);
      el.removeEventListener('pointercancel', lifted);
      el.removeEventListener('focusin', focusIn);
      el.removeEventListener('focusout', focusOut);
    };
  }, [calm]);

  const s = SYSTEMS[at];
  /* the list is a set of tabs: the arrows move along it (↑ ↓ on a desk, ← → on a phone), Home and End to its ends */
  const onKey = (e: React.KeyboardEvent) => {
    const n = SYSTEMS.length;
    const next = { ArrowDown: at + 1, ArrowRight: at + 1, ArrowUp: at - 1, ArrowLeft: at - 1, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const i = (next + n) % n;
    picked.current = true;
    choose(i);
    tabs.current[i]?.focus();
  };
  return (
    <div ref={stage} className="mt-10 lg:mt-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] gap-x-10 xl:gap-x-12 gap-y-6" data-systems>
      {/* THE LIST — the stage's tabs */}
      <div className="lg:col-start-2 lg:row-start-1 min-w-0" data-systems-list>
        <div role="tablist" aria-label="The four systems" aria-orientation={small ? 'horizontal' : 'vertical'} onKeyDown={onKey} className="grid grid-cols-2 gap-2 lg:flex lg:flex-col lg:gap-0">
          {SYSTEMS.map((x, i) => {
            const on = i === at;
            return (
              <button
                key={x.id}
                ref={el => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`system-tab-${x.id}`}
                aria-selected={on}
                aria-controls="system-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => {
                  picked.current = true;
                  choose(i);
                }}
                className={`group/tab relative min-w-0 text-left rounded-full lg:rounded-none border lg:border-0 lg:border-t ${on ? 'border-textPrimary/60 lg:border-borderMuted' : 'border-borderSubtle'} lg:first:border-t-0 px-3.5 py-2 lg:px-0 lg:py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver`}
                data-system-tab={x.id}
              >
                <span className={`flex items-center gap-3 text-[13px] ${on ? 'text-textPrimary' : 'text-textMuted group-hover/tab:text-textSecondary'} transition-colors`}>
                  <span className="hidden lg:inline tnum">{x.code}</span>
                  <span className="hidden lg:inline w-5 h-px bg-borderMuted" aria-hidden="true" />
                  <ProductGlyph name={x.glyph} size={16} bare className="shrink-0" />
                  {x.name}
                </span>
                <span className={`hidden lg:block mt-2.5 text-[21px] xl:text-[23px] leading-[1.15] font-light tracking-[-0.02em] [text-wrap:balance] transition-colors duration-300 ${on ? 'text-textPrimary' : 'text-textMuted group-hover/tab:text-textSecondary'}`}>{x.line}</span>
                {/* THE LINE FILLING: how long until the next page */}
                {on && !calm && (
                  <span className="hidden lg:block absolute left-0 right-0 -bottom-px h-[2px] bg-ink/[0.08] overflow-hidden" aria-hidden="true">
                    <span ref={bar} className="block h-full bg-silver origin-left" style={{ transform: 'scaleX(0)' }} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* the one on screen: on a phone its line over the window; on a desk what it does and its door under the list */}
        <h3 key={`line-${s.id}`} className="lg:hidden mt-5 text-[26px] sm:text-[30px] leading-[1.1] font-light tracking-[-0.03em] [text-wrap:balance] animate-fade-in">
          {s.line}
        </h3>
        {!small && <Does s={s} onOpen={onOpen} />}
      </div>
      {/* THE WINDOW — the page itself, booting into each in turn */}
      <div role="tabpanel" id="system-panel" aria-labelledby={`system-tab-${s.id}`} className="lg:col-start-1 lg:row-start-1 min-w-0" data-systems-stage>
        <TerminalWindow path={s.path} theme={ground} desk={!small} natural lazy boot="switch" bootSweep={s.sweep} />
        {small && <Does s={s} onOpen={onOpen} />}
      </div>
    </div>
  );
};

/* THERE'S MORE INSIDE: the terminal's other rooms, a door each — in their own one-liners (nav.ts, the brand's own), the
   four above left out and Practice's pages under Practice */
const FLAGSHIPS = ['/compass', '/pinpoint', '/terrain', '/trace'];
const MORE = PRODUCTS.filter(p => !FLAGSHIPS.includes(p.path) && !p.path.startsWith('/practice/'));

const More = ({ onOpen }: { onOpen: (path: string) => void }) => (
  <div className="mt-16 lg:mt-24 pt-8 border-t border-borderSubtle" data-landing-inside>
    <p className="text-[17px] sm:text-[18px] leading-[1.5] text-textSecondary">
      <span className="text-textPrimary">There’s more inside.</span> Every room opens on its own page.
    </p>
    <ul className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-6">
      {MORE.map(p => (
        <li key={p.path}>
          <a
            href={p.path}
            onClick={e => {
              e.preventDefault();
              onOpen(p.path);
            }}
            className="group/more block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-silver"
            data-landing-door={`more-${p.glyph}`}
          >
            <span className="flex items-center gap-2.5 text-[15px] font-medium text-textPrimary">
              <ProductGlyph name={p.glyph} size={18} bare className="shrink-0" />
              {p.name}
              <ArrowRight className="w-3.5 h-3.5 text-textMuted opacity-0 -translate-x-1 group-hover/more:opacity-100 group-hover/more:translate-x-0 transition duration-300 motion-reduce:transition-none" aria-hidden="true" />
            </span>
            <span className="mt-1.5 block text-[13.5px] leading-snug text-textMuted group-hover/more:text-textSecondary transition-colors">{p.line}</span>
          </a>
        </li>
      ))}
    </ul>
  </div>
);

/** CAN I TRUST IT? — four principles, and what the terminal observes, calculates and models (what it produces, not how) */
const Trust = () => {
  const head = useArrival<HTMLDivElement>();
  return (
    <Wrap>
      <div ref={head} className="landing-lines grid grid-cols-1 lg:grid-cols-12 gap-x-16 gap-y-6 lg:items-end">
        <div className="lg:col-span-7">
          <div className="landing-line [--i:0]">
            <Eyebrow>Why Slayer</Eyebrow>
          </div>
          <div className="landing-line landing-settle [--i:1]">
            <TwoTone className="mt-6" first="Built on the record." second="Not on promises." />
          </div>
        </div>
        <p className="landing-line [--i:2] lg:col-span-5 max-w-[30rem] text-[16px] leading-relaxed text-textSecondary lg:pb-2">
          The terminal is open about what it shows and where each number comes from. How it works each one out stays ours.
        </p>
      </div>
      <ul className="mt-10 lg:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-borderSubtle" data-landing-principles>
        {PRINCIPLES.map((p, i) => (
          <li key={p.title} className={`py-7 sm:pr-8 border-b border-borderSubtle lg:border-b-0 ${i > 0 ? 'lg:pl-8 lg:border-l' : ''} ${i % 2 === 1 ? 'sm:pl-8 sm:border-l lg:border-l' : ''}`}>
            <p className="tnum text-[13px] text-textMuted">{String(i + 1).padStart(2, '0')}</p>
            <h3 className="mt-3 text-[18px] font-medium tracking-tight">{p.title}</h3>
            <p className="mt-2 text-[14.5px] leading-snug text-textSecondary max-w-[30ch]">{p.says}</p>
          </li>
        ))}
      </ul>
      <div className="mt-14 lg:mt-16" data-landing-kinds>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-textMuted">What every number stands on</h3>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 border-t border-borderSubtle md:divide-x divide-borderSubtle">
          {KINDS.map(k => (
            <div key={k.name} className="py-7 md:px-8 first:md:pl-0 last:md:pr-0 border-b border-borderSubtle md:border-b-0">
              <p className="text-[22px] font-light tracking-[-0.02em]">{k.name}</p>
              <p className="mt-1.5 text-[14.5px] text-textSecondary">{k.says}</p>
              <ul className="mt-5">
                {k.items.map(t => (
                  <li key={t} className="py-2.5 border-t border-borderSubtle text-[14px] leading-snug text-textPrimary">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <a
          href="/legal/data"
          className="group/door mt-6 inline-flex items-center gap-2 text-[13.5px] text-textSecondary hover:text-textPrimary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver rounded-sm"
          data-landing-door="data"
        >
          The Data page, in full
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover/door:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </a>
      </div>
    </Wrap>
  );
};

/** HOW MUCH IS IT? — ONE PLAN: its name, its price, who it is for, the one difference, its door */
const Plan = ({ planKey, onChoose }: { planKey: PlanKey; onChoose: (key: PlanKey) => void }) => {
  const plan = PLANS.find(p => p.key === planKey)!;
  const custom = plan.monthly == null;
  const glyph = PLAN_GLYPH[planKey];
  return (
    <div className="flex flex-col py-8 lg:px-8 first:lg:pl-0 last:lg:pr-0" data-landing-plan={planKey}>
      <div className="flex items-center gap-3">
        {glyph ? <ProductGlyph name={glyph} size={24} bare className="shrink-0" /> : <SlayerMark size={26} bare label="" />}
        <h3 className="text-[18px] font-medium tracking-tight">{plan.name}</h3>
      </div>
      {/* the page's big numbers are its prices — the only figures of ours it shows */}
      <p className="mt-6 flex items-baseline gap-2">
        <span className="text-[38px] sm:text-[44px] font-light leading-none tracking-[-0.045em] tnum">{plan.price}</span>
        {!custom && <span className="text-[15px] text-textMuted">{plan.period}</span>}
      </p>
      <dl className="mt-6 border-t border-borderSubtle">
        <div className="py-3.5 border-b border-borderSubtle">
          <dt className="text-[12px] text-textMuted">For</dt>
          <dd className="mt-1 text-[15px] leading-snug text-textPrimary">{PLAN_FOR[planKey]}</dd>
        </div>
        <div className="py-3.5 border-b border-borderSubtle">
          <dt className="text-[12px] text-textMuted">Holds</dt>
          <dd className="mt-1 text-[15px] leading-snug text-textSecondary">{PLAN_HOLDS[planKey]}</dd>
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
      <span className="h-[20px] px-2 inline-flex items-center rounded-full border border-borderMuted text-[10px] font-medium uppercase tracking-[0.12em] text-textSecondary">Soon</span>
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
        className="group inline-flex items-center gap-2 h-10 pl-4 pr-3.5 rounded-full border border-borderMuted text-[13.5px] font-medium text-textPrimary hover:border-textPrimary/70 hover:bg-ink/[0.06] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver"
        data-landing-side-by-side-door
      >
        {open ? 'Fold the comparison away' : 'Compare the plans in full'}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id="landing-plans-table" className="mt-6 overflow-x-clip animate-fade-in">
          <table className="w-full min-w-[340px] border-collapse text-left">
            <caption className="sr-only">What each plan holds</caption>
            {/* the plans' names stay over the rows they label while the table scrolls under the bar; the bar's own band above
                them is the ground's, so the rows never show through over the names */}
            <thead className="sticky top-[68px] z-10 bg-canvas shadow-[0_-68px_0_0_rgb(var(--canvas))]">
              <tr className="border-b border-borderSubtle">
                <th scope="col" className="py-3 pr-3 sm:pr-4 align-bottom font-mono text-[11px] font-normal uppercase tracking-[0.22em] text-textMuted">
                  What it holds
                </th>
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
  const calm = useReducedMotion();
  const small = useIsBelowLg();
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
        if (top < 88) window.scrollBy({ top: top - 88, behavior: 'auto' });
      });
    };
    document.addEventListener('focusin', landed);
    return () => {
      document.removeEventListener('focusin', landed);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* THE TERMINAL'S SHELL, fetched once the page stands and the network has gone quiet (components/layout/shell.ts — it is
     no longer in the script the landing waits for), so a door into the terminal still opens at once */
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

  return (
    <div className="relative isolate min-h-screen overflow-x-clip font-sans bg-canvas" data-landing="v4" data-theme={a}>
      <a href="#how" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-panel focus:text-textPrimary">
        Skip to how it works
      </a>
      <Nav ground={a} />

      {/* ── WHAT IS THIS? ─────────────────────────────────────────────────────────────────────── */}
      <Block on="a" as="div">
        <Hero onSignUp={signUp} />
      </Block>

      {/* ── WHY DOES IT MATTER? AND SHOW ME ─────────────────────────────────────────────────────── */}
      {/* on a desk, one story: the desk's parts gather into the session's window and it plays the session (Story); on a
          phone, or where less motion is asked for, the words alone and then the session's head and beats */}
      {calm || small ? (
        <>
          <Block on="a" label="Why it matters">
            <Matters />
          </Block>
          <Block on="a" id="how" label="How it works" className="pb-[6vh] scroll-mt-10">
            <Wrap>
              <Head
                eyebrow="How it works"
                first="One session,"
                second="as the terminal saw it."
                aside={<>Five moments from one session on SPY, each read off the terminal as it ran.{!small && !calm && ' Scroll, and the session plays between them.'}</>}
              />
              <div className="mt-6 lg:mt-0">
                <Session theme={a} />
              </div>
            </Wrap>
          </Block>
        </>
      ) : (
        <Block on="a" id="how" label="How it works" className="pb-[4vh] scroll-mt-10">
          <Story theme={a} />
        </Block>
      )}

      {/* ── WHAT ELSE CAN IT SEE? THE FOUR SYSTEMS ───────────────────────────────────────────── */}
      <Block on="a" id="products" label="Products" className="pt-[6vh] pb-[10vh] scroll-mt-10">
        <Wrap>
          <Head
            eyebrow="Products"
            first="Four systems."
            second="One terminal."
            aside={calm ? 'Each as it plays in the terminal. Pick one to see it.' : 'Each as it plays in the terminal, one after another. Pick one to stay on it.'}
          />
          <Systems onOpen={open} />
          <More onOpen={open} />
        </Wrap>
      </Block>

      {/* ── CAN I TRUST IT? ───────────────────────────────────────────────────────────────────── */}
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
            aside="Making an account is free. A plan opens the desks; cancel a monthly plan whenever you like and keep it until the period you paid for ends."
          />
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 border-y border-borderSubtle divide-y lg:divide-y-0 lg:divide-x divide-borderSubtle">
            {PLAN_ORDER.map(k => (
              <Plan key={k} planKey={k} onChoose={choose} />
            ))}
          </div>
          <p className="mt-5 text-[13px] text-textMuted">Prices in US dollars.</p>
          <Compare />
        </Wrap>
      </Block>

      {/* ── LET ME IN: THE QUESTIONS, THE LAST DOOR, THE FOOTER ─────────────────────────────── */}
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
                <span className="text-[13px] text-textMuted">Anything else, ask. A person reads it.</span>
              </div>
            </div>
            <dl className="lg:col-span-7 border-t border-borderSubtle">
              {FAQ.map(f => (
                <div key={f.q} className="py-5 border-b border-borderSubtle" data-landing-faq>
                  <dt className="text-[17px] font-medium tracking-tight">{f.q}</dt>
                  <dd className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-textSecondary">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* THE LAST WORDS (the brief: "End with almost no explanation") */}
          <div className="pt-[16vh] pb-[12vh] text-center" data-landing-close>
            <LitLines
              lines={[
                { text: 'See the market.', ink: 'text-textPrimary' },
                { text: 'Then trade it.', ink: 'text-textMuted' },
              ]}
              className="mx-auto font-light tracking-[-0.045em] leading-[0.96] text-[clamp(2.5rem,5.8vw,5.25rem)] [text-wrap:balance]"
            />
            <div className="mt-9 flex justify-center">
              <Pill href="/signup" onClick={signUp} testId="close">
                Sign up free
              </Pill>
            </div>
            <p className="mt-5 text-[14px] text-textMuted">Enter the terminal and see it yourself.</p>
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
