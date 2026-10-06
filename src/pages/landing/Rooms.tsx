/*
==================================================
  SLAYER TERMINAL - THE ROOMS
  (pages/landing/Rooms.tsx)

  EIGHT ROOMS, ONE TERMINAL (v5, 2026-10-05 — the owner, of the landing of 2026-10-01 at 15:22: "i think this one idea
  wise is one of the better designs we had but it still lacks the wow factor … then you get all the information and we
  should have the tabs on the product things switch faster they take too long right now").

  ON A DESK, ONE STAGE THE SCROLL PLAYS (it stands still, sticky, while the reader scrolls):
    THE WALL — the desk the session ran on splits into the terminal's eight rooms: their pictures lie in a pile in a fine
      grain without their colour, and are dealt out one after another into a wall of eight, each resolving as it lands
      (pixels.ts), its name coming in under it. Each is a door to its room below.
    THE TOUR — the first room's picture grows into the window, and the rooms come one at a time as the reader scrolls:
      the room's words on the left, its page on the right. A room with several pages plays them on its own, a page every
      DWELL, the silver line under the row filling; a pointer moving over the stage holds it until it has been still a
      while, the keys inside hold it, and a picked row holds its room until the reader scrolls on. Each switch resolves
      in a third of a second along the room's own motion (Boot.tsx `sweep`).
    THE TURN — after Pinpoint the ground turns to the other theme ("Dark for the night session." / "Paper for a bright
      room."), slowly, through the steel between, and the terminal turns with it; after Practice it turns home, so the
      page ends on the ground it began on. A ground the reader picked on the page stays put (ground.tsx).
  A phone and less motion have the rooms as tabs over one window (RoomsTabs): a pick changes the room at once, and on a
  phone the rooms play on their own while they are on screen.

  THE PICTURES are the rooms' own stills (the films' first frames — TerminalWindow), fetched once the reader is near;
  the window plays the films. Nothing here is drawn to look like the product.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import TerminalWindow, { shotFor } from './TerminalWindow';
import type { Sweep } from './Boot';
import { useBlockGround, useGround, type Ground } from './ground';
import ProductGlyph from '../../brand/ProductGlyph';
import type { GlyphName } from '../../brand/paths';
import { inksAt, pictureIn, pieceOf, type Piece } from './pixels';
import { unit, useStacked } from './scale';

export interface RoomRow {
  title: string;
  says: string;
  /** a row with an address is a page of the room: it opens that page in the window */
  path?: string;
}

export interface Room {
  id: string;
  code: string;
  glyph: GlyphName;
  /** the kind of room, in a word or two */
  kind: string;
  name: string;
  lead: string;
  rest: string;
  /** the page the room opens on */
  path: string;
  rows: RoomRow[];
  /** the way a page of this room resolves into the window (Boot.tsx) */
  sweep: Sweep;
}

/** a page every DWELL; a pointer holds the room until it has been still STILL_FOR */
const DWELL = 3500;
const STILL_FOR = 2500;

const pagesOf = (r: Room): string[] => {
  const p = r.rows.flatMap(row => (row.path ? [row.path] : []));
  return p.length ? p : [r.path];
};
const doorName = (name: string) => name.replace(/^The /, 'the ');

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const span = (v: number, [a, b]: [number, number]) => (b <= a ? (v >= b ? 1 : 0) : clamp((v - a) / (b - a)));

/* ---- a room's words: shared by the stage and the tabs ------------------------------------- */

interface WordsProps {
  room: Room;
  /** the page on screen */
  shown: string;
  /** the room plays its pages: the line under the row on screen fills */
  playing: boolean;
  bar: (el: HTMLSpanElement | null) => void;
  onPick: (path: string) => void;
  onOpen: (path: string) => void;
  /** the door opens the page picked, else the room's own */
  door: string;
}

const RoomWords = ({ room, shown, playing, bar, onPick, onOpen, door }: WordsProps) => (
  <div className="room-in" data-room-words={room.id}>
    <p className="flex items-center gap-3 text-[0.71875rem] font-medium uppercase tracking-[0.22em] text-textMuted">
      <span className="holo-text tnum">{room.code}</span>
      <span className="w-6 h-px bg-borderMuted" aria-hidden="true" />
      {room.kind}
    </p>
    {/* the room's head wears its glyph, as a product's page head does inside the terminal (brand rules) */}
    <h3 className="mt-4 flex items-center gap-3.5 text-[2.25rem] sm:text-[2.5rem] xl:text-[2.75rem] font-light leading-[1] tracking-[-0.04em] outline-none" data-room-head={room.id}>
      <ProductGlyph name={room.glyph} size={26} bare className="shrink-0 size-[1.625rem]" />
      <span className="min-w-0">{room.name}</span>
    </h3>
    <p className="mt-4 max-w-[40ch] text-[0.9375rem] xl:text-[0.96875rem] leading-[1.5]">
      <span className="font-medium text-textPrimary">{room.lead}</span> <span className="text-textSecondary">{room.rest}</span>
    </p>
    <ul className="mt-5 border-t border-borderSubtle">
      {room.rows.map(r => {
        const here = !!r.path && r.path === shown;
        const body = (
          <>
            <span className={`block text-[0.90625rem] font-medium ${here ? 'text-textPrimary' : 'text-textSecondary group-hover:text-textPrimary'} transition-colors`}>{r.title}</span>
            <span className="mt-0.5 block text-[0.8125rem] leading-snug text-textMuted">{r.says}</span>
          </>
        );
        return (
          <li key={r.title} className="border-b border-borderSubtle">
            {r.path ? (
              <button
                type="button"
                onClick={() => onPick(r.path!)}
                aria-pressed={here}
                data-room-row={r.path}
                className="group relative w-full text-left py-3 pl-4 pr-8 transition-colors hover:bg-ink/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-silver"
              >
                {/* silver is where you are */}
                <span aria-hidden="true" className={`absolute left-0 top-3 bottom-3 w-[0.125rem] rounded-full ${here ? 'foil-fill' : ''}`} />
                {body}
                <ArrowRight aria-hidden="true" className={`absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition ${here ? 'text-textPrimary' : 'text-textMuted opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                {/* the page playing: the line fills, and the room moves on when it is full */}
                {here && playing && <span key={shown} ref={bar} aria-hidden="true" className="foil-fill absolute inset-x-0 -bottom-px h-[0.125rem] origin-left" style={{ transform: 'scaleX(0)' }} data-room-progress />}
              </button>
            ) : (
              <div className="py-3 pl-4 pr-8">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
    <a
      href={door}
      onClick={e => {
        e.preventDefault();
        onOpen(door);
      }}
      className="door-edge group/door mt-6 inline-flex items-center gap-2 h-10 pl-4 pr-3.5 rounded-full border border-borderMuted text-[0.84375rem] font-medium text-textPrimary hover:border-transparent hover:bg-ink/[0.05] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver"
      data-room-door={room.id}
    >
      Open {doorName(room.name)}
      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/door:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
    </a>
  </div>
);

/* ---- playing a room's pages ------------------------------------------------------------------ */

/** THE LINE UNDER THE ROW ON SCREEN fills as its page plays; when full, `next` moves on. Runs only while `on`; held while
    `hold()` says so. The line is written straight to the element, a frame at a time. */
const usePlay = (on: boolean, hold: () => boolean, next: () => void, key: string) => {
  const bar = useRef<HTMLSpanElement | null>(null);
  const elapsed = useRef(0);
  const nextNow = useRef(next);
  nextNow.current = next;
  const holdNow = useRef(hold);
  holdNow.current = hold;
  useEffect(() => {
    elapsed.current = 0;
    if (bar.current) bar.current.style.transform = 'scaleX(0)';
  }, [key]);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      if (!holdNow.current() && document.visibilityState === 'visible') elapsed.current += dt;
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, elapsed.current / DWELL)})`;
      if (elapsed.current >= DWELL) {
        elapsed.current = 0;
        nextNow.current();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  const setBar = useCallback((el: HTMLSpanElement | null) => {
    bar.current = el;
    if (el) el.style.transform = `scaleX(${Math.min(1, elapsed.current / DWELL)})`;
  }, []);
  return { setBar, restart: () => (elapsed.current = 0) };
};

/** A HAND ON THE STAGE HOLDS IT: a pointer moving over it until it has been still a while, a touch until a while after
    it lifts, the keys while they are inside */
const useHands = () => {
  const until = useRef(0);
  const keys = useRef(false);
  const handlers = useMemo(
    () => ({
      onPointerMove: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && (e.movementX || e.movementY)) until.current = performance.now() + STILL_FOR;
      },
      onPointerLeave: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') until.current = 0;
      },
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') until.current = Number.POSITIVE_INFINITY;
      },
      onPointerUp: (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') until.current = performance.now() + 3000;
      },
      onFocus: (e: React.FocusEvent) => {
        if ((e.target as HTMLElement).matches?.(':focus-visible')) keys.current = true;
      },
      onBlur: (e: React.FocusEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) keys.current = false;
      },
    }),
    []
  );
  const holding = useCallback(() => keys.current || performance.now() < until.current, []);
  return { handlers, holding };
};

/* ---- the stage (a desk) ------------------------------------------------------------------------ */

/** THE STAGE'S RUN, in svh: the deal, the wall standing, the wall becoming the tour, each room, the turn and the turn home */
const SEG = { deal: 34, wall: 14, toTour: 26, room: 20, turn: 34, back: 22 };
/** the turn comes after this room (Pinpoint) */
const TURN_AFTER = 3;
/** where the stage's words start, under the floating bar (the design's 96 px, growing with the landing — scale.ts) */
const TOP = '6rem';
/** how sharp a room's picture is in the pile: a fine grain, without its colour */
const APART = 0.42;

interface Plan {
  deal: [number, number];
  wall: [number, number];
  toTour: [number, number];
  rooms: [number, number][];
  turn: [number, number];
  back: [number, number];
  total: number;
}
const planFor = (n: number, turns: boolean): Plan => {
  let at = 0;
  const take = (len: number): [number, number] => {
    const r: [number, number] = [at, at + len];
    at += len;
    return r;
  };
  const deal = take(SEG.deal);
  const wall = take(SEG.wall);
  const toTour = take(SEG.toTour);
  const rooms: [number, number][] = [];
  let turn: [number, number] = [0, 0];
  for (let i = 0; i < n; i++) {
    rooms.push(take(SEG.room));
    if (i === TURN_AFTER) turn = take(turns ? SEG.turn : 0);
  }
  const back = take(turns ? SEG.back : 0);
  return { deal, wall, toTour, rooms, turn, back, total: at };
};

/** the ground's road from one theme to the other, through the steel between (theme/tokens.css --night … --day), as the
    old turn painted it */
const RAMP_AT = [0, 0.2, 0.38, 0.53, 0.66, 0.82, 1];
const readRamp = (): number[][] => {
  const cs = getComputedStyle(document.documentElement);
  return ['--night', '--dawn-1', '--dawn-2', '--dawn-3', '--dawn-4', '--dawn-5', '--day'].map(n => cs.getPropertyValue(n).trim().split(/\s+/).map(Number));
};
const rampAt = (ramp: number[][], t: number): string => {
  let i = 0;
  while (i < RAMP_AT.length - 2 && t > RAMP_AT[i + 1]) i++;
  const u = clamp((t - RAMP_AT[i]) / (RAMP_AT[i + 1] - RAMP_AT[i]));
  const a = ramp[i];
  const b = ramp[i + 1];
  return `rgb(${Math.round(lerp(a[0], b[0], u))} ${Math.round(lerp(a[1], b[1], u))} ${Math.round(lerp(a[2], b[2], u))})`;
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const mix = (a: Rect, b: Rect, t: number): Rect => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });

interface StageProps {
  rooms: Room[];
  head: ReactNode;
  turnSays: Record<Ground, string>;
  onOpen: (path: string) => void;
  /** the stage's place for a jump along the page (the bar's "Rooms"): the wall, dealt — a marker naming the wall's head */
  anchor?: string;
}

const RoomsStage = ({ rooms, head, turnSays, onOpen, anchor }: StageProps) => {
  const { a, b } = useGround();
  const turns = a !== b;
  const plan = useMemo(() => planFor(rooms.length, turns), [rooms.length, turns]);

  const track = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const wallHead = useRef<HTMLDivElement | null>(null);
  const slots = useRef<(HTMLButtonElement | null)[]>([]);
  const pics = useRef<(HTMLSpanElement | null)[]>([]);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const tourLayer = useRef<HTMLDivElement | null>(null);
  const words = useRef<HTMLDivElement | null>(null);
  const winCell = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const frameBar = useRef<HTMLDivElement | null>(null);
  const turnA = useRef<HTMLParagraphElement | null>(null);
  const turnB = useRef<HTMLParagraphElement | null>(null);

  const [room, setRoom] = useState(0);
  const [turned, setTurned] = useState(false);
  /** the window has taken over from the wall's picture */
  const [live, setLive] = useState(false);
  /** the room's words are up (not mid-turn, not before the tour) */
  const [reading, setReading] = useState(false);
  const [page, setPage] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    setPage(0);
    setHeld(false);
  }, [room]);

  const r = rooms[room];
  const pages = pagesOf(r);
  const shown = pages[Math.min(page, pages.length - 1)];
  const { handlers, holding } = useHands();
  const plays = live && reading && !held && pages.length > 1;
  /* WHY THE PAGE CHANGED: a row (played or picked) resolves into the window (Boot.tsx); a room or a ground the scroll
     brings crossfades — a resolve at every room the scroll passed cost the scroll its frames */
  const why = useRef<'row' | 'scroll'>('scroll');
  const { setBar } = usePlay(
    plays,
    holding,
    () => {
      why.current = 'row';
      setPage(p => (p + 1) % pages.length);
    },
    `${r.id}:${page}`
  );

  /* a door to a room: the scroll goes to where the room stands */
  const go = useCallback(
    (i: number) => {
      const t = track.current;
      if (!t) return;
      const vh = window.innerHeight;
      const top = t.getBoundingClientRect().top + window.scrollY;
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: Math.round(top + ((plan.rooms[i][0] + 3) / 100) * vh), behavior: calm ? 'auto' : 'smooth' });
    },
    [plan]
  );

  /* ---- the scroll plays the stage ---- */
  const live0 = useRef(false);
  const room0 = useRef(0);
  const turned0 = useRef(false);
  const reading0 = useRef(false);
  useEffect(() => {
    const t = track.current;
    const st = stage.current;
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!t || !st || !c || !ctx) return;
    let alive = true;
    let raf = 0;
    let listening = false;
    let vw = 0;
    let vh = 0;
    let dpr = 1;
    /** one of the design's pixels (scale.ts) */
    let u = 1;
    let slotR: Rect[] = [];
    let pile: Rect = { x: 0, y: 0, w: 0, h: 0 };
    let win: Rect = { x: 0, y: 0, w: 0, h: 0 };
    let edge = 'rgb(255 255 255 / 0.12)';
    const ramp = readRamp();
    const order = a === 'dark' ? ramp : [...ramp].reverse();
    const imgs: (HTMLImageElement | null)[] = rooms.map(() => null);
    let pieces: (Piece | null)[] = rooms.map(() => null);
    /* the grain a tile passes through on its way, made ahead (a state made mid-scroll cost the frame) */
    let cools: (() => void)[] = [];
    const ready = (p: Piece | null) => {
      if (p) cools.push(p.warm(APART));
      return p;
    };
    /* a landed tile's picture, at its slot's own size: eight full pictures scaled down every frame cost the wall its frames */
    let small: (HTMLCanvasElement | null)[] = rooms.map(() => null);
    const smallOf = (i: number): HTMLCanvasElement | null => {
      const img = imgs[i];
      const sr = slotR[i];
      if (!img || !sr || sr.w < 2) return null;
      const w = Math.round(sr.w * dpr);
      const h = Math.round(sr.h * dpr);
      const hit = small[i];
      if (hit && hit.width === w && hit.height === h) return hit;
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d');
      if (!g) return null;
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, w, h);
      small[i] = cv;
      return cv;
    };
    let last = -1;
    let cleared = false;

    const layout = () => {
      vw = st.clientWidth;
      vh = st.clientHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      u = unit();
      c.width = Math.max(1, Math.round(vw * dpr));
      c.height = Math.max(1, Math.round(vh * dpr));
      const sb = st.getBoundingClientRect();
      slotR = pics.current.map(p => {
        const q = p?.getBoundingClientRect();
        return q ? { x: q.left - sb.left, y: q.top - sb.top, w: q.width, h: q.height } : { x: 0, y: 0, w: 0, h: 0 };
      });
      /* the pile: in the middle of the wall, twice a slot */
      const xs = slotR.map(s => s.x);
      const ys = slotR.map(s => s.y);
      const gx0 = Math.min(...xs);
      const gx1 = Math.max(...slotR.map(s => s.x + s.w));
      const gy0 = Math.min(...ys);
      const gy1 = Math.max(...slotR.map(s => s.y + s.h));
      const w = Math.min((slotR[0]?.w ?? 0) * 2.1, (gx1 - gx0) * 0.55);
      const h = w / (1440 / 1000);
      pile = { x: (gx0 + gx1) / 2 - w / 2, y: (gy0 + gy1) / 2 - h / 2 + 12 * u, w, h };
      const tw = winCell.current?.querySelector<HTMLElement>('[data-terminal-window]')?.getBoundingClientRect();
      win = tw ? { x: tw.left - sb.left, y: tw.top - sb.top, w: tw.width, h: tw.height } : pile;
      const border = getComputedStyle(st).getPropertyValue('--border-muted').trim();
      if (border) edge = `rgb(${border})`;
      cools.forEach(cool => cool());
      cools = [];
      small = rooms.map(() => null);
      /* (read in the design's px: the grain the same on every screen) */
      pieces = imgs.map(img => ready(img && img.naturalWidth ? pieceOf(img, 0, 0, img.naturalWidth, img.naturalHeight, pile.w / u, pile.h / u, inksAt(st)) : null));
      last = -1;
    };

    /** a room's picture at a place: rounded as the wall's slots and the window are, its edge drawn while it is apart */
    const tile = (p: Piece | null, at: Rect, sharp: number, alpha = 1, line = true, copy: HTMLCanvasElement | null = null) => {
      if (alpha <= 0 || at.w < 2) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      const radius = clamp(at.w / 40, 4 * u, 10 * u) * dpr;
      if (typeof ctx.roundRect === 'function') ctx.roundRect(at.x * dpr, at.y * dpr, at.w * dpr, at.h * dpr, radius);
      else ctx.rect(at.x * dpr, at.y * dpr, at.w * dpr, at.h * dpr);
      ctx.save();
      ctx.clip();
      if (copy && sharp >= 1) ctx.drawImage(copy, at.x * dpr, at.y * dpr, at.w * dpr, at.h * dpr);
      else if (p) p.draw(ctx, at.x * dpr, at.y * dpr, at.w * dpr, at.h * dpr, sharp);
      ctx.restore();
      if (line) {
        ctx.strokeStyle = edge;
        ctx.lineWidth = dpr;
        ctx.stroke();
      }
      ctx.restore();
    };

    /** where the scroll stands in the stage's run (svh) */
    const at = () => clamp((-t.getBoundingClientRect().top / Math.max(1, vh)) * 100, 0, plan.total);

    const draw = () => {
      raf = 0;
      if (!alive) return;
      const s = at();
      if (s === last) return;
      last = s;
      const f = span(s, plan.deal);
      const g = span(s, plan.toTour);

      /* which room, and the ground: the turn after Pinpoint, home after the last room */
      let ri = 0;
      plan.rooms.forEach(([r0], i) => {
        if (s >= r0) ri = i;
      });
      let tau = 0;
      let say = -1;
      let wordsIn = clamp((g - 0.45) / 0.4);
      if (turns) {
        if (s >= plan.turn[0] && s < plan.turn[1]) {
          const q = span(s, plan.turn);
          tau = ease(clamp((q - 0.15) / 0.7));
          say = q;
          wordsIn = q < 0.1 ? 1 - q / 0.1 : q > 0.9 ? (q - 0.9) / 0.1 : 0;
        } else if (s >= plan.turn[1] && s < plan.back[0]) tau = 1;
        else if (s >= plan.back[0] && s < plan.back[1]) {
          const q = span(s, plan.back);
          tau = 1 - ease(clamp((q - 0.15) / 0.7));
          wordsIn = q < 0.2 ? 1 : q < 0.35 ? 1 - (q - 0.2) / 0.15 : q < 0.65 ? 0 : q < 0.8 ? (q - 0.65) / 0.15 : 1;
        } else if (s >= plan.back[1] && plan.back[1] > plan.back[0]) tau = 0;
      }
      st.style.backgroundColor = rampAt(order, tau);
      const isTurned = tau >= 0.5;
      if (isTurned !== turned0.current) {
        turned0.current = isTurned;
        why.current = 'scroll';
        setTurned(isTurned);
      }
      if (ri !== room0.current) {
        room0.current = ri;
        why.current = 'scroll';
        setRoom(ri);
      }
      const isLive = g >= 0.98;
      if (isLive !== live0.current) {
        live0.current = isLive;
        setLive(isLive);
      }
      const isReading = isLive && wordsIn >= 0.99;
      if (isReading !== reading0.current) {
        reading0.current = isReading;
        setReading(isReading);
      }

      /* THE WALL'S WORDS AND DOORS */
      const wallOut = clamp(g / 0.3);
      if (wallHead.current) {
        wallHead.current.style.opacity = String(1 - wallOut);
        wallHead.current.style.visibility = wallOut >= 1 ? 'hidden' : '';
      }
      const dealt = rooms.map((_, i) => ease(clamp((f - (0.05 + i * 0.075)) / 0.32)));
      dealt.forEach((u, i) => {
        const lit = clamp((u - 0.75) / 0.25) * (1 - wallOut);
        const lab = labels.current[i];
        if (lab) lab.style.opacity = String(lit);
        const pic = pics.current[i];
        if (pic) pic.style.opacity = String(lit);
        const slot = slots.current[i];
        if (slot) slot.style.pointerEvents = u >= 1 && g < 0.2 ? 'auto' : 'none';
      });

      /* THE TOUR'S WORDS, the window, and the turn's two lines */
      if (tourLayer.current) tourLayer.current.style.visibility = g > 0 ? '' : 'hidden';
      if (words.current) {
        words.current.style.opacity = String(wordsIn);
        words.current.style.visibility = wordsIn > 0 ? '' : 'hidden';
      }
      if (turnA.current) turnA.current.style.opacity = String(say < 0 ? 0 : clamp((say - 0.1) / 0.08) * (1 - clamp((say - 0.32) / 0.08)));
      if (turnB.current) turnB.current.style.opacity = String(say < 0 ? 0 : clamp((say - 0.58) / 0.08) * (1 - clamp((say - 0.8) / 0.08)));

      /* THE FRAME, growing from the first room's place on the wall into the window */
      const e = ease(g);
      const fr = frame.current;
      const from: Rect = slotR[0] ?? pile;
      const box = mix(from, win, e);
      if (fr) {
        const on = g > 0 && !isLive;
        fr.style.opacity = on ? '1' : '0';
        if (on) {
          fr.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
          fr.style.width = `${box.w}px`;
          fr.style.height = `${box.h}px`;
        }
      }
      if (frameBar.current) frameBar.current.style.opacity = String(clamp((g - 0.35) / 0.45));

      /* THE PICTURES — the pile, the deal, the wall, and the first room growing into the window */
      const drawn = s < plan.toTour[1] + 6;
      if (!drawn) {
        if (!cleared) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, c.width, c.height);
          cleared = true;
        }
        return;
      }
      cleared = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      const gone = clamp(g / 0.35);
      /* the wall's landed tiles (the first grows on its own, below) */
      dealt.forEach((u, i) => {
        if (u < 1 || i === 0) return;
        const sr = slotR[i];
        const k = 1 - 0.08 * gone;
        tile(pieces[i], { x: sr.x + (sr.w * (1 - k)) / 2, y: sr.y + (sr.h * (1 - k)) / 2, w: sr.w * k, h: sr.h * k }, 1, 1 - gone, false, smallOf(i));
      });
      /* the pile: the next to be dealt on top, in its grain; the ones under it only their edges */
      const top = dealt.findIndex(u => u <= 0);
      if (top >= 0) {
        for (let i = Math.min(rooms.length - 1, top + 2); i > top; i--) {
          const depth = i - top;
          tile(null, { x: pile.x + depth * 9 * u, y: pile.y + depth * 9 * u, w: pile.w, h: pile.h }, 0, 1 - depth * 0.3);
        }
        tile(pieces[top], pile, APART);
      }
      /* the ones in flight, the latest dealt on top: sharpening and taking their colour as they land */
      dealt.forEach((u, i) => {
        if (u <= 0 || u >= 1) return;
        tile(pieces[i], mix(pile, slotR[i], u), APART + (0.99 - APART) * Math.pow(u, 1.3));
      });
      /* the first room: on the wall, then growing into the window (its picture under the frame's bar) */
      if (dealt[0] >= 1) {
        const pic: Rect = g > 0 ? { x: box.x + 1, y: box.y + 1 + 40 * u * e, w: box.w - 2, h: box.h - 2 - 40 * u * e } : slotR[0];
        tile(pieces[0], pic, 1, 1, false, g > 0 ? null : smallOf(0));
      }
    };
    const ask = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    /* the rooms' pictures, fetched once the reader is near */
    let fetched = false;
    const fetchAll = () => {
      if (fetched) return;
      fetched = true;
      rooms.forEach((room, i) => {
        const img = new Image();
        img.decoding = 'async';
        img.src = shotFor(room.path, a, 'desk');
        pictureIn(img).then(
          () => {
            if (!alive) return;
            imgs[i] = img;
            pieces[i] = ready(pieceOf(img, 0, 0, img.naturalWidth, img.naturalHeight, pile.w / u, pile.h / u, inksAt(st)));
            last = -1;
            ask();
          },
          () => {}
        );
      });
    };

    layout();
    draw();
    const io = new IntersectionObserver(
      ([en]) => {
        if (en.isIntersecting) {
          fetchAll();
          if (!listening) {
            listening = true;
            window.addEventListener('scroll', ask, { passive: true });
          }
        } else if (listening) {
          listening = false;
          window.removeEventListener('scroll', ask);
        }
        ask();
      },
      { rootMargin: '100% 0px' }
    );
    io.observe(t);
    let resized = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resized);
      resized = window.setTimeout(() => {
        if (!alive) return;
        layout();
        ask();
      }, 120);
    });
    ro.observe(st);
    void document.fonts?.ready.then(() => {
      if (!alive) return;
      layout();
      ask();
    });
    return () => {
      alive = false;
      cools.forEach(cool => cool());
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('scroll', ask);
      cancelAnimationFrame(raf);
      window.clearTimeout(resized);
    };
  }, [a, turns, plan, rooms]);

  const ground = turned ? b : a;
  return (
    <div ref={track} className="relative" style={{ height: `${plan.total + 100}svh` }} data-rooms-track>
      {anchor && (
        <span
          id={anchor}
          data-focus="#rooms-head h2"
          aria-hidden="true"
          className="absolute left-0 w-px h-px pointer-events-none"
          style={{ top: `${plan.deal[1] + 4}svh`, scrollMarginTop: 0 }}
        />
      )}
      <div ref={stage} data-theme={ground} className="sticky top-0 h-[100svh] overflow-hidden bg-canvas text-textPrimary" data-rooms-stage {...handlers}>
        <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* THE WALL — its head, and a door for each room (the pictures are the canvas's, under the slots) */}
        <div className="absolute inset-0">
          <div className="mx-auto w-full h-full max-w-[var(--landing-col)] px-10 flex flex-col pb-[6svh]" style={{ paddingTop: TOP }}>
            <div ref={wallHead}>{head}</div>
            <div className="flex-1 min-h-0 flex items-center">
              <ul className="w-full grid grid-cols-4 gap-x-5 gap-y-7" aria-label="The rooms">
                {rooms.map((x, i) => (
                  <li key={x.id}>
                    <button
                      ref={el => {
                        slots.current[i] = el;
                      }}
                      type="button"
                      onClick={() => go(i)}
                      style={{ pointerEvents: 'none' }}
                      className="group block w-full text-left rounded-[0.5rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-silver"
                      data-rooms-slot={x.id}
                    >
                      <span
                        ref={el => {
                          pics.current[i] = el;
                        }}
                        aria-hidden="true"
                        className="block w-full aspect-[1440/1000] rounded-[0.4375rem] border border-borderMuted transition-colors group-hover:border-textPrimary/50"
                        style={{ opacity: 0 }}
                      />
                      <span
                        ref={el => {
                          labels.current[i] = el;
                        }}
                        className="mt-3 flex items-center gap-2.5 text-[0.875rem] text-textSecondary group-hover:text-textPrimary transition-colors"
                        style={{ opacity: 0 }}
                      >
                        <span className="holo-text text-[0.6875rem] font-medium tracking-[0.12em] tnum">{x.code}</span>
                        <ProductGlyph name={x.glyph} size={16} bare className="shrink-0 size-[1rem]" />
                        {x.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* THE FRAME, as the first room's picture grows into the window: its edge, and the bar coming in */}
        <div ref={frame} aria-hidden="true" className="absolute left-0 top-0 overflow-hidden rounded-[0.625rem] border border-borderMuted pointer-events-none will-change-transform" style={{ opacity: 0 }}>
          <div ref={frameBar} className="h-10 pl-3.5 pr-4 flex items-center gap-2.5 border-b border-borderSubtle bg-panel" style={{ opacity: 0 }}>
            <ProductGlyph name="terminal" size={16} bare className="shrink-0 size-[1rem]" />
            <span className="font-code text-[0.71875rem] text-textMuted whitespace-nowrap">
              slayer:~ $<span className="ml-[1ch] text-textPrimary">open pulse</span>
            </span>
          </div>
        </div>

        {/* THE TOUR — the room's words on the left, its page on the right */}
        <div ref={tourLayer} className="absolute inset-0 pointer-events-none [&>*>*]:pointer-events-auto" style={{ visibility: 'hidden' }}>
          <div className="mx-auto w-full h-full max-w-[var(--landing-col)] px-10 grid grid-cols-[minmax(0,19rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] gap-x-10 xl:gap-x-12">
            <div ref={words} className="min-w-0 flex flex-col pb-8" style={{ paddingTop: TOP, opacity: 0, visibility: 'hidden' }}>
              {/* THE RAIL: every room, the one on screen lit — a door to each */}
              <nav aria-label="The rooms" className="flex items-center gap-0.5 -ml-2">
                {rooms.map((x, i) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={x.name}
                    aria-current={i === room ? 'true' : undefined}
                    title={x.name}
                    className={`relative w-8 h-8 inline-flex items-center justify-center rounded-md transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-silver ${i === room ? '' : 'opacity-40'}`}
                    data-rooms-rail={x.id}
                  >
                    <ProductGlyph name={x.glyph} size={16} bare className="size-[1rem]" />
                    {i === room && <span aria-hidden="true" className="foil-fill absolute left-2 right-2 -bottom-0.5 h-[0.125rem] rounded-full" />}
                  </button>
                ))}
              </nav>
              <div className="mt-8" key={r.id}>
                <RoomWords
                  room={r}
                  shown={shown}
                  playing={plays}
                  bar={setBar}
                  onPick={path => {
                    why.current = 'row';
                    setPage(Math.max(0, pages.indexOf(path)));
                    setHeld(true);
                  }}
                  onOpen={onOpen}
                  door={held ? shown : r.path}
                />
              </div>
            </div>
            <div ref={winCell} className="min-w-0" style={{ paddingTop: TOP, visibility: live ? undefined : 'hidden' }} data-rooms-window>
              <div style={{ width: 'min(100%, calc((min(100svh - 8.25rem, 53.75rem) - 2.5rem - 2px) * 1.44 + 2px))' }}>
                <TerminalWindow path={shown} theme={ground} desk natural lazy boot={why.current === 'row' ? 'switch' : undefined} bootSweep={r.sweep} hold={!live} />
              </div>
            </div>
          </div>
        </div>

        {/* THE TURN'S TWO LINES — each on the ground it names */}
        {turns && (
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
            <div className="mx-auto w-full h-full max-w-[var(--landing-col)] px-10 flex items-center">
              <div className="relative w-full">
                <p ref={turnA} data-theme={a} className="absolute left-0 top-1/2 -translate-y-1/2 max-w-[11ch] text-textPrimary font-light text-[3.25rem] leading-[1.02] tracking-[-0.04em]" style={{ opacity: 0 }} data-rooms-turn="a">
                  {turnSays[a]}
                </p>
                <p ref={turnB} data-theme={b} className="absolute left-0 top-1/2 -translate-y-1/2 max-w-[11ch] text-textPrimary font-light text-[3.25rem] leading-[1.02] tracking-[-0.04em]" style={{ opacity: 0 }} data-rooms-turn="b">
                  {turnSays[b]}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ---- the tabs (a phone, and less motion) ------------------------------------------------------- */

const RoomsTabs = ({ rooms, head, onOpen }: Omit<StageProps, 'turnSays' | 'anchor'>) => {
  const ground = useBlockGround();
  /* a phone, a tablet, or a screen taller than it is wide (scale.ts): the window over the room's words */
  const small = useStacked();
  const calm = !!useReducedMotion();
  const [at, setAt] = useState(0);
  const [page, setPage] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  /* a pick holds the rooms until they leave the screen */
  const [picked, setPicked] = useState(false);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => {
        setSeen(e.isIntersecting);
        if (!e.isIntersecting) setPicked(false);
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const r = rooms[at];
  const pages = pagesOf(r);
  const shown = pages[Math.min(page, pages.length - 1)];
  const { handlers, holding } = useHands();
  /* on a phone the rooms play on their own while on screen: a room's pages, then the next room */
  const plays = !calm && seen && !picked;
  const { setBar } = usePlay(
    plays,
    holding,
    () => {
      if (page + 1 < pages.length) setPage(page + 1);
      else {
        setPage(0);
        setAt(i => (i + 1) % rooms.length);
      }
    },
    `${r.id}:${page}`
  );
  const choose = (i: number) => {
    setAt(i);
    setPage(0);
    setPicked(true);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const n = rooms.length;
    const next = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const i = (next + n) % n;
    choose(i);
    tabs.current[i]?.focus();
  };
  return (
    <div ref={box} {...handlers} data-rooms-tabs>
      {head}
      <div role="tablist" aria-label="The rooms" onKeyDown={onKey} className="mt-8 grid grid-cols-4 gap-2">
        {rooms.map((x, i) => {
          const on = i === at;
          return (
            <button
              key={x.id}
              ref={el => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`room-tab-${x.id}`}
              aria-selected={on}
              aria-controls="room-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => choose(i)}
              className={`relative min-w-0 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-2xl sm:rounded-full border px-2 py-2.5 sm:py-2 text-[0.75rem] sm:text-[0.8125rem] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver ${
                on ? 'border-textPrimary/60 text-textPrimary' : 'border-borderSubtle text-textMuted hover:text-textSecondary'
              }`}
              data-room-tab={x.id}
            >
              <ProductGlyph name={x.glyph} size={16} bare className="shrink-0 size-[1rem]" />
              <span className="truncate max-w-full">{x.name.replace(/^The /, '')}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id="room-panel" aria-labelledby={`room-tab-${r.id}`} className={`mt-6 ${small ? '' : 'grid grid-cols-[minmax(0,1fr)_minmax(0,20rem)] gap-x-10 xl:gap-x-12'}`}>
        <div className="min-w-0">
          <TerminalWindow path={shown} theme={ground} desk={!small} natural lazy boot="switch" bootSweep={r.sweep} />
        </div>
        <div className={`${small ? 'mt-7' : ''} min-w-0`} key={r.id}>
          <RoomWords
            room={r}
            shown={shown}
            playing={plays}
            bar={setBar}
            onPick={path => {
              setPage(Math.max(0, pages.indexOf(path)));
              setPicked(true);
            }}
            onOpen={onOpen}
            door={picked ? shown : r.path}
          />
        </div>
      </div>
    </div>
  );
};

/* ---- the rooms ----------------------------------------------------------------------------------- */

const Rooms = (props: StageProps) => {
  const small = useStacked();
  const calm = useReducedMotion();
  return small || calm ? <RoomsTabs rooms={props.rooms} head={props.head} onOpen={props.onOpen} /> : <RoomsStage {...props} />;
};

export default Rooms;
