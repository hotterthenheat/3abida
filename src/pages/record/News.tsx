/*
==================================================
  SLAYER TERMINAL - NEWS (pages/record/News.tsx)

  The wire, rebuilt from a blank canvas under the
  Record (Noah, 2026-09-09: "everything of benefit
  related to news, what it effects, numbers,
  interactive parts. but most importantly i want a
  2d map that has pins on the news you click").
  Two boxes, read top to bottom:

    THE WIRE    the head with four facts, one line
                of cards, then the MAP with a pin on
                every city the day's stories come
                from beside THE STORY in hand — its
                grade, its numbers, what the options
                book thinks of it, the odds, the
                playbook, what kills it, where it
                lands, and the doors — then every
                story as a row; a click on a row or
                a pin picks the story
    THE DAY     what is ahead on the calendar, and
                the reads the wire adds up to

  Everything speaks the two engines that were here
  before (data/news.ts, data/newsroom.ts); the room
  they used to fill is archived in
  docs/news-page-reference.md.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Bell, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import Fold from '../../components/ui/Fold';
import { useMarketData } from '../../context/MarketDataContext';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import DropdownMulti, { type MultiGroup } from '../../components/ui/DropdownMulti';
import GuideFocus, { GuideDoor } from '../../components/ui/GuideFocus';
import AnimatedNumber from '../../components/ui/AnimatedNumber';
import CompanyLogo from '../../components/ui/CompanyLogo';
import RichRead from '../../components/ui/RichRead';
import CatTag from '../../components/news/CatTag';
import NewsMap, { HeatLegend, nextOpen, openSessions, type FlyTo, type HeatPoint, type Reach } from '../../components/record/NewsMap';
import { now } from '../../core/clock';
import { NewsGuide } from '../../components/record/NewsGuide';
import { armNews, removeAlert, useAlerts } from '../../components/gex/alertStore';
import Simulator from '../../core/simulator';
import { useBoardNames } from '../../data/boardNames';
import { buildNewsDeepRead, marketMood, type NewsCategory } from '../../data/news';
import { lookup } from '../../data/universe';
import { buildEconCalendar, buildGeoNews, buildRoomInsights, clusterByCity, freshnessOf, severityWord, type CityPing, type GeoNewsEvent, type NewsGrade } from '../../data/newsroom';
import { ImpactLegend, ImpactMark, tierOf } from '../../components/record/impactMark';
import NewsFeedTabs from '../../components/record/NewsFeedTabs';
/* `GRADE_INK` here is the story's LEAN (positive · negative); the four words' inks come in under another name */
import { GRADE_INK as READ_INK } from '../../components/ui/GradeMeter';
import { gradeOfNewsConfidence } from '../../data/news';
import NewsCalendar from '../../components/record/NewsCalendar';
import { NEWS_ROW_H } from './recordSkeletons';

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const GRADE_INK: Record<NewsGrade, string> = { THREAT: 'text-bear', ALLY: 'text-bull', WATCH: 'text-textSecondary' };
const GRADE_BAR: Record<NewsGrade, string> = { THREAT: 'bg-bear/85', ALLY: 'bg-bull', WATCH: 'bg-ink/40' };
/** The grade in the page's words — how the story reads for the name (Noah, 2026-09-09: "positive, negative") */
const GRADE_WORD: Record<NewsGrade, string> = { THREAT: 'negative', ALLY: 'positive', WATCH: 'neutral' };

type CategoryPick = 'all' | NewsCategory;
type LeanPick = 'any' | NewsGrade;
type NamesPick = 'all' | 'board' | 'macro';
type Sort = 'newest' | 'move' | 'sure' | 'loud';

const CATEGORY_OPTIONS: DropdownOption<CategoryPick>[] = [
  { value: 'all', label: 'All', hint: 'Every kind of story' },
  { value: 'Earnings', label: 'Earnings', hint: 'Prints and what they said' },
  { value: 'Guidance', label: 'Guidance', hint: 'What a company said about what is coming' },
  { value: 'Analyst', label: 'Analyst', hint: 'Upgrades, downgrades, targets' },
  { value: 'Macro', label: 'Macro', hint: 'The economy and the Fed — no single name' },
  { value: 'M&A', label: 'M&A', hint: 'Deals, bids, spin-offs' },
  { value: 'Product', label: 'Product', hint: 'Launches and reviews' },
  { value: 'Regulatory', label: 'Regulatory', hint: 'Courts, agencies, probes' },
];
const LEAN_OPTIONS: DropdownOption<LeanPick>[] = [
  { value: 'any', label: 'Any lean', hint: 'Positive, negative and neutral stories' },
  { value: 'ALLY', label: 'Positive', hint: 'Stories the model reads as good for the name', tone: 'bull' },
  { value: 'THREAT', label: 'Negative', hint: 'Stories the model reads as bad for the name', tone: 'bear' },
  { value: 'WATCH', label: 'Neutral', hint: 'Stories with no clear direction yet' },
];
const NAMES_OPTIONS: DropdownOption<NamesPick>[] = [
  { value: 'all', label: 'Every name', hint: 'Every story on the wire' },
  { value: 'board', label: 'Your board', hint: 'Stories on the names on your Board' },
  { value: 'macro', label: 'Macro only', hint: 'Stories with no single name' },
];
const SORT_OPTIONS: DropdownOption<Sort>[] = [
  { value: 'newest', label: 'Newest', hint: 'The latest story first' },
  { value: 'move', label: 'Biggest move', hint: 'The largest expected one-day move first' },
  { value: 'sure', label: 'Most sure', hint: 'The reads the model is surest of first' },
  { value: 'loud', label: 'Loudest', hint: 'The hardest-landing story first' },
];

/* THE IMPACT MARK lives in components/record/impactMark.tsx since 2026-09-13 — the All news box and the month draw the same square */

const ago = (m: number) => (m < 1 ? 'just now' : m < 60 ? `${Math.round(m)}m ago` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m ago`);
const signed = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;

/*
  THE TAPE (2026-09-13), WITH A WAY BACK (Noah, 2026-09-16: "what if a user
  misses a key news event and it scrolled away too soon"): the newest 14
  headlines on the cut crossing the top of the map, two identical halves as
  one seamless loop. It used to be a CSS marquee that only paused under the
  pointer; now a frame loop drives it so it can be PULLED — it holds still
  under the pointer or a focus, the wheel or a drag moves it by hand, the
  arrows at its ends step one headline back or on with a glide, and it
  resumes when let go. The rows under the map stay the record — this is
  the glance, never the archive. Reduced motion: it stands still and the
  arrows and the wheel are the only way it moves.
*/
/** One loop of the tape at rest — the CSS marquee's 110s, kept */
const TAPE_SECONDS_PER_LOOP = 110;
/** The lead before the first headline (the halves' `pl-4`) — a step lands a headline behind it */
const TAPE_LEAD = 16;
/** A drag past this many px is a pull, not a click */
const TAPE_DRAG_PX = 4;

const NewsTape = ({ tape, selectedId, onPick }: { tape: GeoNewsEvent[]; selectedId: string | null; onPick: (e: GeoNewsEvent) => void }) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const halfRef = useRef<HTMLSpanElement | null>(null);
  /* where the strip stands, px ≤ 0; the loop wraps it by one half's width */
  const xRef = useRef(0);
  /* a step's destination — the loop glides there and holds */
  const targetRef = useRef<number | null>(null);
  const holdRef = useRef({ hover: false, focus: false, drag: false });
  const dragRef = useRef<{ startX: number; x0: number; moved: boolean } | null>(null);
  /* the click after a pull is the pull's, not the headline's */
  const pulledRef = useRef(false);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const still = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = 0;
    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(64, ts - last) : 16;
      last = ts;
      const halfW = halfRef.current?.offsetWidth ?? 0;
      if (halfW <= 0) return;
      const h = holdRef.current;
      let x = xRef.current;
      const target = targetRef.current;
      if (target != null) {
        x += (target - x) * (1 - Math.exp(-dt / 90));
        if (Math.abs(target - x) < 0.5) {
          x = target;
          targetRef.current = null;
        }
      } else if (!(h.hover || h.focus || h.drag) && !still) {
        x -= (halfW / TAPE_SECONDS_PER_LOOP) * (dt / 1000);
      }
      /* the loop: the two halves are identical, so a half's width is a full turn */
      if (x <= -halfW) {
        x += halfW;
        if (targetRef.current != null) targetRef.current += halfW;
      } else if (x > 0) {
        x -= halfW;
        if (targetRef.current != null) targetRef.current -= halfW;
      }
      /* only a move is written: an unchanged transform is still a style change, and the tape holds still under a
         pointer (2026-09-30, the perf pass — a data attribute written every frame, which nothing read, restyled the
         strip sixty times a second on top) */
      if (x === xRef.current && strip.style.transform) return;
      xRef.current = x;
      strip.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [tape.length > 0]);

  /* THE WHEEL PULLS IT — a native listener, because React's wheel is passive and the page
     would scroll under a pull; the map beside it takes the wheel the same way */
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault();
      targetRef.current = null;
      xRef.current -= d;
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
  }, []);

  /* A STEP: the next (or the previous) headline's start lands behind the lead, gliding */
  const step = (dir: 1 | -1) => {
    const half = halfRef.current;
    const halfW = half?.offsetWidth ?? 0;
    if (!half || halfW <= 0) return;
    const lefts = [...half.children].map(c => (c as HTMLElement).offsetLeft - TAPE_LEAD);
    if (!lefts.length) return;
    const cur = (((-xRef.current) % halfW) + halfW) % halfW;
    let dist: number;
    if (dir === 1) {
      const next = lefts.find(l => l > cur + 1);
      dist = (next ?? lefts[0] + halfW) - cur;
    } else {
      const before = lefts.filter(l => l < cur - 1);
      const prev = before.length ? before[before.length - 1] : lefts[lefts.length - 1] - halfW;
      dist = cur - prev;
    }
    targetRef.current = xRef.current - dir * dist;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, x0: xRef.current, moved: false };
    holdRef.current.drag = true;
    targetRef.current = null;
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > TAPE_DRAG_PX) d.moved = true;
    if (d.moved) xRef.current = d.x0 + dx;
  };
  const endDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    pulledRef.current = d.moved;
    dragRef.current = null;
    holdRef.current.drag = false;
  };
  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!pulledRef.current) return;
    pulledRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };
  const arrow = 'hit shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle bg-chip text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors';

  return (
    <div
      ref={boxRef}
      className="relative h-[30px] border-b border-ink/[0.06] flex items-center gap-1 px-1.5"
      data-news-tape={tape.length}
      onPointerEnter={() => (holdRef.current.hover = true)}
      onPointerLeave={() => {
        holdRef.current.hover = false;
        endDrag();
      }}
      /* a KEYBOARD focus holds it (a Tab onto a headline must not have it slide away); a click's
         focus does not, or the tape would stand still after every pick and every arrow */
      onFocus={e => (holdRef.current.focus = e.target.matches(':focus-visible'))}
      onBlur={() => (holdRef.current.focus = false)}
    >
      <button type="button" onClick={() => step(-1)} aria-label="Back one headline" title="Back one headline" className={arrow} data-news-tape-step="back">
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <div
        className="relative flex-1 min-w-0 h-full overflow-hidden select-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        data-news-tape-strip
      >
        {tape.length > 0 && (
          <div ref={stripRef} className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap w-max will-change-transform">
            {[0, 1].map(half => (
              <span key={half} ref={half === 0 ? halfRef : undefined} className="inline-flex items-center pl-4" aria-hidden={half === 1 || undefined}>
                {tape.map(e => (
                  <button
                    key={`${half}-${e.id}`}
                    type="button"
                    tabIndex={half === 1 ? -1 : 0}
                    onClick={() => onPick(e)}
                    className={`hit group inline-flex items-center gap-2 mr-9 transition-colors ${e.id === selectedId ? 'text-textPrimary' : 'text-textSecondary hover:text-textPrimary'}`}
                    title={`${e.item.headline} · ${e.item.source} · ${ago(e.item.minutesAgo)}`}
                    data-news-tape-item={half === 0 ? e.id : undefined}
                  >
                    <ImpactMark tier={tierOf(e.severity)} />
                    <span className="font-mono text-[10px] font-bold text-textPrimary">{e.item.ticker ?? 'MACRO'}</span>
                    <span className="text-[11px]">{e.item.headline}</span>
                    <span className="font-mono text-[10px] text-textMuted">{ago(e.item.minutesAgo)}</span>
                  </button>
                ))}
              </span>
            ))}
          </div>
        )}
      </div>
      <button type="button" onClick={() => step(1)} aria-label="On one headline" title="On one headline" className={arrow} data-news-tape-step="on">
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

/** A door out — small, labelled, never a naked icon; warms the name on hover so the landing is instant */
const Door = ({ onClick, onWarm, children }: { onClick: () => void; onWarm?: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    onMouseEnter={onWarm}
    className="hit inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted font-mono text-[10px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors"
  >
    <ArrowUpRight className="w-3 h-3" />
    {children}
  </button>
);

/** ALERTS ON A NAME'S NEWS (2026-09-13; the partner: "have alerts on for
    specific tickers"): the bell's own news alert, set from the story card —
    a headline landing on this name after now rings the bell (alertStore
    `armNews`, judged by the shell's watcher); lit holo silver while set, a
    second click takes it off. One per name (the store's own rule). */
const NewsAlertDoor = ({ ticker }: { ticker: string }) => {
  const alerts = useAlerts(ticker);
  const set = alerts.find(a => a.kind === 'news') ?? null;
  return (
    <button
      type="button"
      onClick={() => (set ? removeAlert(ticker, set.id) : armNews(ticker, Date.now()))}
      aria-pressed={!!set}
      title={set ? `The bell rings when a headline lands on ${ticker} · click to take it off` : `Ring the bell when a headline lands on ${ticker}`}
      className={`hit inline-flex items-center gap-1 h-6 px-2 rounded-md border font-mono text-[10px] uppercase tracking-widest transition-colors ${set ? 'border-silver/50 text-silver bg-silver/[0.08]' : 'border-borderSubtle bg-chip hover:border-borderMuted text-textSecondary hover:text-textPrimary'}`}
      data-news-alert={set ? 'set' : 'off'}
    >
      <Bell className="w-3 h-3" />
      {set ? `Alert set · ${ticker}` : `Alert me · ${ticker}`}
    </button>
  );
};

const Fact = ({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) => (
  <div>
    <dt className="text-[10px] text-textMuted whitespace-nowrap">{label}</dt>
    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-news-fact={testId}>
      {children}
    </dd>
  </div>
);

/** A figure on the story card — label over value, the card's own smaller scale */
const Figure = ({ label, tone = 'text-textPrimary', children, title }: { label: string; tone?: string; children: React.ReactNode; title?: string }) => (
  <div className="min-w-0" title={title}>
    <div className="text-[10px] text-textMuted whitespace-nowrap truncate">{label}</div>
    <div className={`mt-0.5 font-mono text-[12px] font-semibold tnum whitespace-nowrap ${tone}`}>{children}</div>
  </div>
);

/** The odds, Down against Up — NOT keyed by story, so the split slides between stories (the v1 contract) */
const OddsBar = ({ probUp }: { probUp: number }) => (
  <div data-news-odds>
    <div className="flex items-center justify-between font-mono text-[10px] tnum">
      <span className={probUp < 50 ? 'text-bear font-semibold' : 'text-textSecondary'}>
        down <AnimatedNumber value={100 - probUp} format={v => `${Math.round(v)}%`} />
      </span>
      <span className="text-[10px] uppercase tracking-widest text-textMuted">how similar stories closed next session</span>
      <span className={probUp >= 50 ? 'text-bull font-semibold' : 'text-textSecondary'}>
        up <AnimatedNumber value={probUp} format={v => `${Math.round(v)}%`} />
      </span>
    </div>
    <div className="mt-1.5 flex h-[6px] rounded-full overflow-hidden bg-ink/[0.06]">
      <span className="h-full bg-bear/80" style={{ width: `${100 - probUp}%`, transition: `width 520ms ${EASE}` }} />
      <span className="h-full bg-bull" style={{ width: `${probUp}%`, transition: `width 520ms ${EASE}` }} />
    </div>
  </div>
);

/** The story's text: the first paragraph in the open, the rest behind "Read the whole story" (the house's fold), the source's door at the end */
const StoryText = ({ storyId, body, source, url }: { storyId: string; body: string[]; source: string; url?: string }) => {
  const [whole, setWhole] = useState(false);
  /* a new story opens folded — the same element re-read, never remounted (a keyed remount left the old body standing) */
  useEffect(() => setWhole(false), [storyId]);
  if (!body.length) return null;
  const [first, ...rest] = body;
  return (
    <div className="flex flex-col gap-2" data-news-body data-news-body-open={whole || undefined}>
      <p className="text-[12.5px] leading-relaxed text-textSecondary">{first}</p>
      {rest.length > 0 && (
        <>
          <Fold axis="y" open={whole} testId="data-news-body-fold">
            <div className="flex flex-col gap-2 pb-1">
              {rest.map((para, i) => (
                <p key={i} className="text-[12.5px] leading-relaxed text-textSecondary">
                  {para}
                </p>
              ))}
            </div>
          </Fold>
          <button
            type="button"
            onClick={() => setWhole(w => !w)}
            aria-expanded={whole}
            className="hit self-start inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-textMuted hover:text-textPrimary transition-colors"
            data-news-body-door
          >
            {whole ? 'Fold the story' : 'Read the whole story'}
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${whole ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </>
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="self-start inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors" data-news-body-source>
          Read it at {source} <ArrowUpRight className="w-3 h-3" aria-hidden />
        </a>
      )}
    </div>
  );
};

const News = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { changeTicker } = useMarketData();
  const boardNames = useBoardNames();

  /* THE WIRE TICKS — stories drip in through the session; re-read every half minute */
  const [wireRev, setWireRev] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setWireRev(r => r + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const events = useMemo(() => buildGeoNews(), [wireRev]); // eslint-disable-line react-hooks/exhaustive-deps
  const calendar = useMemo(() => buildEconCalendar(), [wireRev]); // eslint-disable-line react-hooks/exhaustive-deps
  const mood = useMemo(() => marketMood(), [wireRev]); // eslint-disable-line react-hooks/exhaustive-deps

  /* THE MOMENT — the wire's clock, re-read with it. The page is live only:
     the day's drip bar under the map, which pulled the wire and the map back
     to any minute of the session, came off on 2026-09-13 (Noah: "remove the
     replay bar"). */
  const at = useMemo(() => now(), [wireRev]); // eslint-disable-line react-hooks/exhaustive-deps
  const insights = useMemo(() => buildRoomInsights(events), [events]);

  /* THE CARDS cut the wire; the map and the list read the same cut */
  const [category, setCategory] = useState<CategoryPick>('all');
  const [lean, setLean] = useState<LeanPick>('any');
  const [names, setNames] = useState<NamesPick>('all');
  const [sort, setSort] = useState<Sort>('newest');
  /* THE FILTER reads what the other three cards leave on the wire — every
     name and every city there, with its count — and keeps any number of them
     (Noah: "it should read whats on the current page … so user can select
     what to add"). A pick is `name:NVDA` or `city:Riyadh`; any pick matching
     keeps the row. */
  /* a name's page opens the wire on that name (2026-09-13) */
  const [picks, setPicks] = useState<string[]>(() => {
    const n = (location.state as { name?: string } | null)?.name;
    return n ? [`name:${n.toUpperCase()}`] : [];
  });
  const cut = useMemo(() => {
    const board = new Set(boardNames);
    return events.filter(e => {
      if (category !== 'all' && e.item.category !== category) return false;
      if (lean !== 'any' && e.grade !== lean) return false;
      if (names === 'board' && !(e.item.ticker && board.has(e.item.ticker))) return false;
      if (names === 'macro' && e.item.ticker) return false;
      return true;
    });
  }, [events, category, lean, names, boardNames]);
  const filterGroups = useMemo<MultiGroup[]>(() => {
    const nameCount = new Map<string, number>();
    const cityCount = new Map<string, number>();
    cut.forEach(e => {
      const n = e.item.ticker ?? 'MACRO';
      nameCount.set(n, (nameCount.get(n) ?? 0) + 1);
      cityCount.set(e.origin.city, (cityCount.get(e.origin.city) ?? 0) + 1);
    });
    /* a pick whose name has left the cut stays listed so it can be unpicked */
    picks.forEach(p => {
      const [kind, key] = p.split(':');
      if (kind === 'name' && !nameCount.has(key)) nameCount.set(key, 0);
      if (kind === 'city' && !cityCount.has(key)) cityCount.set(key, 0);
    });
    const byCountThenName = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);
    return [
      {
        title: 'Names on the wire',
        options: [...nameCount.entries()].sort(byCountThenName).map(([n, c]) => ({ value: `name:${n}`, label: n, hint: n === 'MACRO' ? 'Stories with no single name' : lookup(n)?.name, count: c })),
      },
      {
        title: 'Cities on the map',
        options: [...cityCount.entries()].sort(byCountThenName).map(([c, n]) => ({ value: `city:${c}`, label: c, count: n })),
      },
    ];
  }, [cut, picks]);
  const rows = useMemo(() => {
    const picked = new Set(picks);
    const kept = picked.size === 0 ? cut : cut.filter(e => picked.has(`name:${e.item.ticker ?? 'MACRO'}`) || picked.has(`city:${e.origin.city}`));
    const by: Record<Sort, (a: GeoNewsEvent, b: GeoNewsEvent) => number> = {
      newest: (a, b) => a.item.minutesAgo - b.item.minutesAgo,
      move: (a, b) => Math.abs(b.item.prediction.expMove1dPct) - Math.abs(a.item.prediction.expMove1dPct),
      sure: (a, b) => b.item.prediction.confidencePct - a.item.prediction.confidencePct,
      loud: (a, b) => b.severity - a.severity,
    };
    return [...kept].sort(by[sort]);
  }, [cut, picks, sort]);
  const pins = useMemo(() => clusterByCity(rows), [rows]);
  /* THE HEAT: where the cut's news lands, every story's zones summed by place */
  const heat = useMemo<HeatPoint[]>(() => {
    const sum = new Map<string, HeatPoint>();
    rows.forEach(e =>
      e.impacts.forEach(zn => {
        const key = `${zn.lat},${zn.lng}`;
        const had = sum.get(key);
        if (had) had.w += zn.w;
        else sum.set(key, { lat: zn.lat, lng: zn.lng, w: zn.w });
      })
    );
    return [...sum.values()];
  }, [rows]);

  /* THE STORY IN HAND — the Pulse tile's deep link opens on its story; else the first */
  const [selectedId, setSelectedId] = useState<string | null>(() => (location.state as { selectedId?: string } | null)?.selectedId ?? null);
  useEffect(() => {
    if (rows.length === 0) return;
    if (!selectedId || !rows.some(r => r.id === selectedId)) setSelectedId(rows[0].id);
  }, [rows, selectedId]);
  const selected = rows.find(r => r.id === selectedId) ?? events.find(e => e.id === selectedId) ?? null;
  const deep = useMemo(() => (selected ? buildNewsDeepRead(selected.item) : null), [selected]);
  /* THE GLIDE (2026-09-13; the partner: the map should "move in a flat
     manner" from place to place): a story picked by hand — a row, a pin, a
     headline on the tape — pans the world to its city on the house curve;
     the first story of the day, picked for the reader, does not move it */
  const [flyTo, setFlyTo] = useState<FlyTo | null>(null);
  const pick = (e: GeoNewsEvent) => {
    setSelectedId(e.id);
    setFlyTo({ lng: e.origin.lng, lat: e.origin.lat, key: `${e.id}:${Date.now()}` });
  };
  /* THE TAPE — the newest headlines on the cut crossing the top of the map,
     whatever the sort (the partner: "no section for all news… I don't see
     any headlines whatsoever" — the rows sat under the fold) */
  const tape = useMemo(() => [...rows].sort((a, b) => a.item.minutesAgo - b.item.minutesAgo).slice(0, 14), [rows]);
  const reach = useMemo<Reach | null>(() => (selected ? { lat: selected.origin.lat, lng: selected.origin.lng, city: selected.origin.city, zones: selected.impacts } : null), [selected]);
  const sessionsOpen = useMemo(() => openSessions(at), [at]);
  /* nothing open (a night, a weekend): which market opens next and how long until it, so the read line never just says "no" */
  const nextUp = useMemo(() => (sessionsOpen.length ? null : nextOpen(at)), [sessionsOpen, at]);
  const untilWords = (ms: number) => {
    const m = Math.max(0, Math.round(ms / 60_000));
    const h = Math.floor(m / 60);
    return h ? `${h}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`;
  };
  const [hoverCity, setHoverCity] = useState<CityPing | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  /* THE FACTS */
  const positive = rows.filter(r => r.grade === 'ALLY').length;
  const negative = rows.filter(r => r.grade === 'THREAT').length;
  const biggest = rows.filter(r => r.item.ticker).reduce<GeoNewsEvent | null>((m, r) => (!m || Math.abs(r.item.prediction.expMove1dPct) > Math.abs(m.item.prediction.expMove1dPct) ? r : m), null);
  const nextPrint = calendar.find(c => c.impact === 'high' && c.inMinutes >= 0) ?? calendar.find(c => c.inMinutes >= 0) ?? null;
  const moodInk = mood.label === 'LEANS BULLISH' ? 'text-bull' : mood.label === 'LEANS BEARISH' ? 'text-bear' : 'text-textPrimary';

  const openName = (t: string) => {
    changeTicker(t);
    navigate('/pinpoint/map');
  };

  return (
    <>
      {/* BOX 1 — THE WIRE */}
      <div className="relative border border-borderSubtle rounded-md bg-panel" data-news data-news-wire>
        <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the wire" testId="news-guide" viewport>
          <NewsGuide />
        </GuideFocus>
        {/* THE HEAD */}
        <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="h-6 flex items-center gap-3">
              <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">The wire</h3>
              <GuideDoor className="hit" open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the pins, the lean and the numbers mean" testId="news-guide" />
            </div>
            <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Every story on the wire today · a pin on every city a story comes from · click a pin or a row and the story opens beside the map</p>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            <Fact label="Stories" testId="stories">
              {rows.length} <span className="text-textMuted">· {positive} positive · {negative} negative</span>
            </Fact>
            <Fact label="The wire leans" testId="mood">
              <span className={moodInk}>{mood.label === 'LEANS BULLISH' ? 'bullish' : mood.label === 'LEANS BEARISH' ? 'bearish' : 'mixed'}</span>
            </Fact>
            <Fact label="Biggest move" testId="biggest">
              {biggest ? (
                <>
                  {biggest.item.ticker} <span className={biggest.item.prediction.expMove1dPct >= 0 ? 'text-bull' : 'text-bear'}>{signed(biggest.item.prediction.expMove1dPct)}</span>
                </>
              ) : (
                <span className="text-textMuted">—</span>
              )}
            </Fact>
            <Fact label="Next print" testId="next">
              {nextPrint ? (
                <>
                  {nextPrint.title} <span className={nextPrint.inMinutes < 90 ? 'text-warn' : 'text-textMuted'}>· in {nextPrint.inMinutes < 60 ? `${nextPrint.inMinutes}m` : `${Math.floor(nextPrint.inMinutes / 60)}h ${nextPrint.inMinutes % 60}m`}</span>
                </>
              ) : (
                <span className="text-textMuted">nothing ahead today</span>
              )}
            </Fact>
          </dl>
        </div>
        {/* THE ONE LINE OF CONTROLS */}
        <div className="px-5 pb-3 flex items-center gap-2 flex-wrap" data-news-controls>
          <DropdownSelect label="Lean" value={lean} options={LEAN_OPTIONS} onChange={setLean} title="Which way the story reads for the name" testId="news-lean" />
          <DropdownSelect label="Names" value={names} options={NAMES_OPTIONS} onChange={setNames} title="Whose stories" testId="news-names" />
          <DropdownSelect label="Sort" value={sort} options={SORT_OPTIONS} onChange={setSort} title="The order of the wire" testId="news-sort" />
          <HeatLegend className="ml-2" />
          <div className="ml-auto" title="The names and cities on the wire right now — tick any number; the map and the list keep only those">
            <DropdownMulti label="Filter" values={picks} groups={filterGroups} onChange={setPicks} title="Keep only these" testId="news-filter" />
          </div>
        </div>

        {/* THE MAP AND THE STORY */}
        {/* The story beside the map from md; under it on a phone (the phone pass, 2026-09-13) */}
        <div className="grid border-t border-borderSubtle grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]" data-news-band>
          <div className="min-w-0 flex flex-col border-r border-borderSubtle max-lg:border-r-0 max-lg:border-b">
            {/* THE TAPE — the newest headlines on a loop, with a way back (NewsTape above) */}
            <NewsTape tape={tape} selectedId={selectedId} onPick={pick} />
            {/* a column, so the map fills the box when the story beside it is the taller of the two (NewsMap's frameFor) */}
            <div className="relative flex-1 min-h-0 flex flex-col px-2 pt-2">
              <NewsMap className="flex-1 min-h-0 max-lg:flex-none max-lg:h-[260px]" pins={pins} selectedCity={selected?.origin.city ?? null} hoverCity={hoverCity?.city ?? null} onPick={p => { const e = rows.find(r => r.id === p.topId) ?? events.find(r => r.id === p.topId); if (e) pick(e); else setSelectedId(p.topId); }} onHover={setHoverCity} heat={heat} reach={reach} at={at} flyTo={flyTo} />
              {/* THE KINDS, AT THE MAP'S FOOT (Noah, 2026-09-13, his partner's reference map: "the different subsections… with the
                  buttons at the bottom, the different sections pulling it up"): the choice pills of the type design — one on,
                  solid holo silver — each pulling that kind of story up on the map, the tape, the rows and the story */}
              {/* Below lg the kinds fold into two centred rows inside the map's width (the phone pass, 2026-09-13): centred on a point, eight pills ran off both sides */}
              {/* below lg the kinds stand ABOVE the map, never over it (the audit's DO-4: the two rows of pills covered a 160 px map) */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 p-1 rounded-full border border-borderSubtle bg-chip/90 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)] max-lg:static max-lg:order-first max-lg:mb-2 max-lg:translate-x-0 max-lg:flex max-lg:flex-wrap max-lg:justify-center max-lg:rounded-2xl max-lg:shadow-none" role="group" aria-label="What kind of story" data-news-kinds={category}>
                {CATEGORY_OPTIONS.map(o => {
                  const on = o.value === category;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setCategory(o.value)}
                      aria-pressed={on}
                      title={o.hint}
                      /* the silver SURFACE, not the silver ink (2026-09-16): on paper the ink is a deep steel and black on it was 2.4:1 */
                      className={`hit h-6 px-3 rounded-full font-mono text-[10px] tracking-wide transition-colors ${on ? 'bg-silverFill text-[rgb(var(--night))] font-semibold' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06]'}`}
                      data-news-kind={o.value}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* ONE READ LINE under the map */}
            <div className="px-4 h-[26px] border-t border-ink/[0.06] flex items-center gap-3 font-mono text-[10px] text-textSecondary whitespace-nowrap overflow-hidden" data-news-map-read>
              {hoverCity ? (
                <>
                  <span className="font-bold text-textPrimary">{hoverCity.city}</span>
                  <span>
                    {hoverCity.n} {hoverCity.n === 1 ? 'story' : 'stories'}
                    {hoverCity.threats > 0 && <span className="text-bear"> · {hoverCity.threats} negative</span>}
                    {hoverCity.allies > 0 && <span className="text-bull"> · {hoverCity.allies} positive</span>}
                  </span>
                  <span className="text-textMuted truncate">· {hoverCity.topHeadline}</span>
                  <span className="ml-auto text-textMuted">click for its loudest story</span>
                </>
              ) : (
                <>
                  <span className="text-textMuted truncate">
                    {pins.length} {pins.length === 1 ? 'city' : 'cities'} · the land warms where the news lands · the arcs are where the open story reaches · scroll to zoom, pull to pan
                  </span>
                  <span className="ml-auto shrink-0" data-news-session-read>
                    {sessionsOpen.length ? (
                      <>
                        <span className="text-silver">{sessionsOpen.map(s => s.label).join(', ')}</span> <span className="text-textMuted">open</span>
                      </>
                    ) : (
                      <span className="text-textMuted">
                        no cash session open
                        {nextUp && (
                          <>
                            {' · '}
                            <span className="text-textSecondary">{nextUp.session.label}</span> opens in {untilWords(nextUp.at.getTime() - at.getTime())}
                          </>
                        )}
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* THE STORY IN HAND */}
          <div className="min-w-0 px-4 pt-3 pb-3 flex flex-col gap-3" data-news-story={selected?.id}>
            {selected && deep ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  {selected.item.ticker ? (
                    <button type="button" onClick={() => openName(selected.item.ticker!)} className="hit inline-flex items-center gap-1.5 group" title={`Open ${selected.item.ticker} on the Map`}>
                      <CompanyLogo ticker={selected.item.ticker} size={16} />
                      <span className="font-mono text-[12px] font-bold text-textPrimary group-hover:underline underline-offset-2">{selected.item.ticker}</span>
                    </button>
                  ) : (
                    <span className="font-mono text-[12px] font-bold text-textPrimary">MACRO</span>
                  )}
                  <span className={`font-mono text-[10px] font-semibold uppercase tracking-widest ${GRADE_INK[selected.grade]}`}>{GRADE_WORD[selected.grade]}</span>
                  {/* a story with no name already reads MACRO — its kind is not said twice (the audit's DO-13) */}
                  {!(selected.item.category === 'Macro' && !selected.item.ticker) && <CatTag category={selected.item.category} size={10} />}
                  <span className="ml-auto font-mono text-[10px] text-textMuted whitespace-nowrap">
                    {selected.item.source} · {ago(selected.item.minutesAgo)}
                  </span>
                </div>
                <p className="text-[13px] leading-snug text-textPrimary" data-news-headline>
                  {selected.item.headline}
                </p>
                {/* THE STORY (Noah, 2026-09-28: "some users actually want to read the story") — its opening paragraph, the
                    rest behind one door that unfolds in place, and the way to the source when the provider gives one */}
                <StoryText storyId={selected.id} body={selected.item.body} source={selected.item.source} url={selected.item.url} />
                {/* the impact, as a meter, in the grade's ink */}
                <div>
                  <div className="flex items-center justify-between text-[10px] text-textMuted">
                    <span className="inline-flex items-center gap-1.5">
                      <ImpactMark tier={tierOf(selected.severity)} />
                      <span>
                        Lands <span className="text-textSecondary">{severityWord(selected.severity)}</span> · from <span className="text-textSecondary">{selected.origin.city}</span>
                      </span>
                    </span>
                    <span>{freshnessOf(selected)}</span>
                  </div>
                  <div className="mt-1 h-[4px] rounded-full bg-ink/[0.06] overflow-hidden">
                    <span className={`block h-full rounded-full ${GRADE_BAR[selected.grade]}`} style={{ width: `${selected.severity * 10}%`, transition: `width 520ms ${EASE}` }} />
                  </div>
                </div>
                {/* THE NUMBERS — what the model expects, and what the options book thinks of it */}
                <div className="grid grid-cols-3 gap-x-3 gap-y-2.5" data-news-numbers>
                  <Figure label="1-day expected" tone={selected.item.prediction.expMove1dPct >= 0 ? 'text-bull' : 'text-bear'}>
                    <AnimatedNumber value={selected.item.prediction.expMove1dPct} format={v => signed(v)} />
                  </Figure>
                  <Figure label="5-day expected" tone={selected.item.prediction.expMove5dPct >= 0 ? 'text-bull' : 'text-bear'}>
                    <AnimatedNumber value={selected.item.prediction.expMove5dPct} format={v => signed(v)} />
                  </Figure>
                  {/* a word, never the figure (Noah, 2026-09-19) — data/news.ts gradeOfNewsConfidence */}
                  <Figure label="Confidence" tone={READ_INK[gradeOfNewsConfidence(selected.item.prediction.confidencePct)]}>
                    <span data-news-sure={gradeOfNewsConfidence(selected.item.prediction.confidencePct)}>{gradeOfNewsConfidence(selected.item.prediction.confidencePct)}</span>
                  </Figure>
                  <Figure label="Already priced in" title="How much of the expected move the tape has discounted already" tone={deep.pricedInPct >= 70 ? 'text-warn' : 'text-textPrimary'}>
                    <AnimatedNumber value={deep.pricedInPct} format={v => `${Math.round(v)}%`} />
                  </Figure>
                  <Figure label="Keeps working" title="Sessions until the story's pull halves">
                    {deep.halfLifeSessions.toFixed(1)} <span className="text-[10px] font-normal text-textMuted">sessions</span>
                  </Figure>
                  <Figure label="The options book" title="Whether dealer positioning backs the story or leans against it" tone={deep.bookLabel === 'CONFIRMS' ? 'text-bull' : deep.bookLabel === 'FADES' ? 'text-bear' : 'text-textSecondary'}>
                    {deep.bookLabel === 'CONFIRMS' ? 'backs it' : deep.bookLabel === 'FADES' ? 'fades it' : 'neutral'}
                  </Figure>
                </div>
                <OddsBar probUp={selected.item.prediction.probUpPct} />
                {/* THE WORDS — the playbook, the analog, what kills it — keyed so they soft-fade per story */}
                <div key={selected.id} className="flex flex-col gap-2 animate-soft-in text-[11.5px] leading-relaxed text-textSecondary">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-textMuted">What tends to be watched</div>
                    <p className="mt-0.5">
                      <RichRead text={selected.item.prediction.playbook} />
                    </p>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-textMuted">Before, stories like this</div>
                    <p className="mt-0.5">
                      <RichRead text={selected.item.prediction.analog} />
                    </p>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-textMuted">What would change the read</div>
                    <p className="mt-0.5">
                      <RichRead text={deep.invalidation} />
                    </p>
                  </div>
                </div>
                {/* WHERE IT LANDS — the story's zones, the heaviest first */}
                {selected.impacts.length > 0 && (
                  <div className="flex flex-col gap-1.5" data-news-zones>
                    <div className="text-[10px] uppercase tracking-widest text-textMuted">Where it lands · {selected.impacts.length} zones</div>
                    {[...selected.impacts]
                      .sort((a, b) => b.w - a.w)
                      .slice(0, 4)
                      .map(z => (
                        <div key={z.label} className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-textPrimary w-28 truncate">{z.label}</span>
                          <span className="flex-1 h-[4px] rounded-full bg-ink/[0.06] overflow-hidden">
                            <span className={`block h-full rounded-full ${GRADE_BAR[selected.grade]}`} style={{ width: `${Math.min(100, z.w * 10)}%` }} />
                          </span>
                          <span className="font-mono text-[10px] text-textMuted w-9 text-right">{z.w >= 7 ? 'heavy' : z.w >= 4 ? 'firm' : 'light'}</span>
                        </div>
                      ))}
                  </div>
                )}
                {/* THE DOORS — a macro story has no name of its own, so its door is the index */}
                <div className="mt-auto pt-2 border-t border-ink/[0.06] flex items-center gap-2 flex-wrap" data-news-doors>
                  {selected.item.ticker ? (
                    <>
                      <Door onWarm={() => Simulator.ensureTicker(selected.item.ticker!)} onClick={() => openName(selected.item.ticker!)}>
                        The Map
                      </Door>
                      <Door onWarm={() => Simulator.ensureTicker(selected.item.ticker!)} onClick={() => navigate('/weigher', { state: { weigh: { ticker: selected.item.ticker } } })}>
                        Weigh it
                      </Door>
                      <Door onWarm={() => Simulator.ensureTicker(selected.item.ticker!)} onClick={() => navigate('/compass', { state: { tickerFilter: selected.item.ticker } })}>
                        Compass
                      </Door>
                      {selected.item.category === 'Earnings' && <Door onClick={() => navigate(`/dossier/earnings/${selected.item.ticker}`)}>Earnings</Door>}
                      <NewsAlertDoor ticker={selected.item.ticker} />
                    </>
                  ) : (
                    <>
                      <Door onWarm={() => Simulator.ensureTicker('SPY')} onClick={() => openName('SPY')}>
                        SPY on the Map
                      </Door>
                      <Door onWarm={() => Simulator.ensureTicker('SPY')} onClick={() => navigate('/pinpoint/ahead')}>
                        Where SPY closes
                      </Door>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center font-mono text-[10px] uppercase tracking-widest text-textMuted">Nothing on the wire for these cards</div>
            )}
          </div>
        </div>

        {/* THE ROWS — every story on the cut, in the chosen order */}
        {/* Below lg the rows scroll sideways inside their box at a readable width (the phone pass, 2026-09-13) */}
        <div className="border-t border-borderSubtle max-lg:overflow-x-auto" data-news-rows>
          <div className="px-5 h-[22px] grid items-center gap-x-3 text-[10px] uppercase tracking-widest text-textMuted max-lg:min-w-[640px]" style={{ gridTemplateColumns: '72px 104px 96px 72px minmax(0, 1fr) 76px 72px' }}>
            <span>Time</span>
            <span>Name</span>
            <span>Kind</span>
            <span>Reads</span>
            <span className="flex items-center gap-4">
              <span>Headline</span>
              {/* the legend sits under the cards line on a narrow page (the head's column has no room for it) */}
              <span className="max-lg:hidden">
                <ImpactLegend />
              </span>
            </span>
            <span className="text-right">1-day</span>
            <span className="text-right">Sure</span>
          </div>
          {rows.length === 0 && <div className="px-5 py-6 text-center font-mono text-[10px] uppercase tracking-widest text-textMuted">Nothing on the tape for these cards</div>}
          {rows.map(e => {
            const open = e.id === selectedId;
            /* AN OLD STORY (three hours and more) RECEDES BY ITS PLAIN WORDS — the time, the name and the headline drop a tier —
               never by fading the row: an opacity took the reads, the move and the sure word with it, and on paper the green
               and the orange fell under 3:1 (2026-09-30) */
            const quiet = freshnessOf(e) === 'faded' && !open;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => pick(e)}
                className={`hit group w-full text-left px-5 grid items-center gap-x-3 border-t border-borderSubtle/40 transition-colors max-lg:min-w-[640px] ${open ? 'bg-silver/[0.06] shadow-[inset_2px_0_0_0_rgb(var(--silver)/0.7)]' : 'hover:bg-silver/[0.05]'}`}
                style={{ height: NEWS_ROW_H, gridTemplateColumns: '72px 104px 96px 72px minmax(0, 1fr) 76px 72px' }}
                data-news-row={e.id}
                data-open={open || undefined}
                data-faded={quiet || undefined}
              >
                <span className={`font-mono text-[10px] tnum ${quiet ? 'text-textMuted' : 'text-textSecondary'}`}>{e.item.time}</span>
                <span className={`min-w-0 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold ${quiet ? 'text-textSecondary' : 'text-textPrimary'}`}>
                  {e.item.ticker ? (
                    <>
                      <CompanyLogo ticker={e.item.ticker} size={14} />
                      {e.item.ticker}
                    </>
                  ) : (
                    <span className="text-textSecondary">MACRO</span>
                  )}
                </span>
                <span className="min-w-0">
                  <CatTag category={e.item.category} size={10} />
                </span>
                <span className={`font-mono text-[10px] font-semibold uppercase tracking-widest ${GRADE_INK[e.grade]}`}>{GRADE_WORD[e.grade]}</span>
                <span className="min-w-0 flex items-center gap-2">
                  <ImpactMark tier={tierOf(e.severity)} />
                  <span className={`min-w-0 truncate text-[12px] ${open ? 'text-textPrimary' : quiet ? 'text-textMuted group-hover:text-textPrimary' : 'text-textSecondary group-hover:text-textPrimary'} transition-colors`}>{e.item.headline}</span>
                </span>
                <span className={`text-right font-mono text-[11px] font-semibold tnum ${e.item.prediction.expMove1dPct >= 0 ? 'text-bull' : 'text-bear'}`}>{signed(e.item.prediction.expMove1dPct)}</span>
                <span className={`text-right font-mono text-[10px] font-semibold ${READ_INK[gradeOfNewsConfidence(e.item.prediction.confidencePct)]}`} data-news-row-sure>
                  {gradeOfNewsConfidence(e.item.prediction.confidencePct)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="px-5 pb-4 pt-3 border-t border-borderSubtle/40 text-[12px] leading-relaxed text-textSecondary" data-news-sentence>
          <RichRead text={mood.note} />
        </p>
      </div>

      {/* BOX 2 — ALL NEWS: every headline as a feed with tabs, and the names you follow (the partner's box, ported 2026-09-13) */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-news-all>
        <div className="px-5 pt-4 pb-3">
          <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">All news</h3>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Every headline on the wire, newest first · a tab per kind · follow a name and ring the bell on it · a click opens the story beside the map</p>
        </div>
        <div className="border-t border-borderSubtle">
          <NewsFeedTabs events={events} calendar={calendar} selectedId={selectedId} onPick={pick} />
        </div>
      </div>

      {/* BOX 3 — THE DAY: the month on the record beside the day in hand (the partner's, ported 2026-09-13), and what the wire adds up to */}
      <div className="border border-borderSubtle rounded-md bg-panel" data-news-day>
        <div className="px-5 pt-4 pb-3">
          <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">The day</h3>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">What is ahead on the calendar — walk the months, open a day — and the reads the wire adds up to</p>
        </div>
        <div className="border-t border-borderSubtle">
          <NewsCalendar />
        </div>
        {/* THE READS — across, under the month, however many the wire adds up to */}
        <div className="grid border-t border-borderSubtle" style={{ gridTemplateColumns: `repeat(${Math.max(1, insights.length)}, minmax(0, 1fr))` }} data-news-reads>
          {insights.map((i, k) => (
            <div key={i.key} className={`px-5 py-3 ${k > 0 ? 'border-l border-borderSubtle/40' : ''}`} data-news-read={i.key}>
              <div className={`text-[10px] font-semibold uppercase tracking-widest ${i.ink === 'bull' ? 'text-bull' : i.ink === 'bear' ? 'text-bear' : 'text-textPrimary'}`}>{i.title}</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-textPrimary/85">
                <RichRead text={i.read} />
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default News;
