/*
==================================================
  SLAYER TERMINAL - THE DOCK OF DESKS
  (pages/landing/Wall.tsx)

  EVERY DESK ON THE FIRST SCREEN (2026-10-01 — the
  owner, of the rooms that waited behind buttons: "the
  first thing you see should be all the desks not you
  having to click on each one"). Each screen plays a
  sped-up stretch of someone working the room with
  nothing over it but their cursor
  (scripts/make-landing-clips.mjs films them and writes
  these small copies: public/landing/wall/).

  A DOCK, NOT A GRID (2026-10-02 — the owner, of the
  four-by-two grid: "i dont want it to look like this
  on the front it should be motion … make them like
  side by side and when u move your cursor they move
  with it like the apple mac dock but more dramatic of
  course and add a bit more info on them"), and then,
  with a picture of a ring of faces, the middle one
  larger and lit: "the main one comes out and the rest
  are in the back and you can move your cursor". The
  eight stand side by side across the row; one is always
  in front — full size, on top, lifted, its words under
  it (what kind of room it is, its line, its pages) — and
  the rest step back, smaller and dimmer and tucked under
  their neighbours the further they are from it. The
  pointer's place along the row is the one that comes
  out; when no one is steering, the dock moves on by
  itself, one room every few seconds, there and back. On
  a phone, or anything without a pointer that hovers, the
  row is a strip a thumb swipes, the card in the middle
  in front and the others behind it.

  THE COST. Eight small films play at once, only while
  the dock is on screen and the tab is in front; each
  starts its own share further into its film, so the
  dock never ticks in step. The depth is each card's
  transform and a veil's opacity, written straight to the
  page a frame at a time while it moves and not at all
  once it rests (nothing is laid out again; no
  endless loop: the idle step is a timer, and each glide
  eases in and stops). The strip plays only the films
  of the cards on screen. Where less motion is asked for,
  the dock does not move by itself and the screens are
  stills; data saved, stills too. The glyph sits bare on
  the screen's bar: no box round any logo.
==================================================
*/

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Theme } from '../../theme/theme';
import ProductGlyph from '../../brand/ProductGlyph';
import type { GlyphName } from '../../brand/paths';
import { savingData, slug } from './TerminalWindow';

export interface WallRoom {
  id: string;
  name: string;
  glyph?: GlyphName;
  path: string;
  /** what kind of room it is, in a word or two ("The tape") */
  kind?: string;
  /** its line */
  lead?: string;
  /** its pages, or what it holds */
  rows?: { title: string }[];
}

const stillFor = (path: string, theme: Theme) => `/landing/wall/${slug(path)}-${theme}.webp`;
const filmFor = (path: string, theme: Theme) => `/landing/wall/clips/${slug(path)}-${theme}.mp4`;

/* ---- THE DOCK'S GEOMETRY -------------------------------------------------------------------------------------------- */

/** a screen's shape — the desk the films are shot on */
const ASPECT = 1440 / 1000;
/** the card's bar: its glyph and name */
const BAR = 28;
/** the words under the card in front */
const WORDS = 118;
/** a card at the back against the one in front */
const BACK = 0.44;
/** how far the swell reaches either side, in cards */
const REACH = 0.8;
/** the least a card overlaps the one beside it (the rest of the row's width is shared out so the row spans its box; on a
    short screen, where the cards are small, even this least overlap leaves the row short of its box, and it is centred) */
const OVERLAP_MIN = 0.18;
/** the card in front stands this much above the others */
const LIFT = 12;
/** a step on its own: the glide from one room to the next */
const GLIDE = 900;
/** …and the rest on each room before the next */
const REST = 2600;
/** the first step waits this long after the dock comes on screen */
const FIRST = 2200;
/** the dock rests this long after the pointer leaves before it moves on by itself */
const WAIT = 3200;
/** under the pointer, the time it takes to close most of the gap (a time constant) */
const FOLLOW = 70;
/** a glide's pace: eases in and out, and stops dead on the room (easeInOutCubic) */
const glide = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
/** a pointer that has stopped this long brings its card all the way out */
const SETTLE = 140;
/** the card in front: the one the row is heading for once it is past half-way, else the nearest */
const frontOf = (st: { f: number; to: number }) => (Math.abs(st.f - Math.round(st.to)) <= 0.5 ? Math.round(st.to) : Math.round(st.f));
/** the stacking: nearer the front is higher, finely enough that no two tie, and the card in front wins a tie */
const stackOf = (d: number, front: boolean) => 1000 - Math.round(d * 100) + (front ? 1 : 0);
/** what stands above the dock on a desk (the signature, the line, the words and the door, and their margins) */
const ABOVE = 434;

/** each card's size against the one in front, the card at `f` (an index, or between two) in front */
const scales = (n: number, f: number) => Array.from({ length: n }, (_, i) => BACK + (1 - BACK) * Math.exp(-(((i - f) / REACH) ** 2)));
/** THE ROW: each card's centre and size. The cards overlap, each tucked under the one nearer the front, and the overlap is
    whatever makes the row span its width — so the card in front travels the row as `f` does, from the left end to the
    right one, and the ones behind fan out either side of it (a row that cannot span its box is centred in it). */
const rowAt = (n: number, f: number, big: number, width: number) => {
  const s = scales(n, f);
  const w = s.map(x => big * x);
  let pairs = 0;
  for (let i = 1; i < n; i++) pairs += (w[i - 1] + w[i]) / 2;
  const ends = w[0] / 2 + w[n - 1] / 2;
  const overlap = Math.max(OVERLAP_MIN, 1 - (width - ends) / pairs);
  const c = [w[0] / 2];
  for (let i = 1; i < n; i++) c.push(c[i - 1] + ((w[i - 1] + w[i]) / 2) * (1 - overlap));
  const span = c[n - 1] + w[n - 1] / 2;
  const shift = (width - span) / 2;
  return { s, w, c: c.map(x => x + shift) };
};
/** the widest the card in front may be: a third of the row or so, and no taller than the screen leaves under the words */
const bigFor = (width: number, tall: number) => Math.max(240, Math.min(width * 0.36, 540, (tall - BAR) * ASPECT));

/** a media query, live */
const useMatch = (query: string) => {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const set = () => setOn(m.matches);
    set();
    m.addEventListener('change', set);
    return () => m.removeEventListener('change', set);
  }, [query]);
  return on;
};

/* ---- ONE ROOM'S SCREEN ---------------------------------------------------------------------------------------------- */

interface Screens {
  theme: Theme;
  /** a card the strip has scrolled out of sight (its film rests) or back in */
  seenIn: (id: string, on: boolean) => void;
  film: (id: string) => boolean;
  tag: (id: string) => string;
  ready: Set<string>;
  hold: (id: string, el: HTMLVideoElement | null) => void;
  canPlay: (k: string, i: number, v: HTMLVideoElement) => void;
  broke: (id: string) => void;
}

const Screen = ({ r, i, s }: { r: WallRoom; i: number; s: Screens }) => (
  <span className="relative block w-full aspect-[1440/1000] overflow-hidden bg-canvas">
    <img src={stillFor(r.path, s.theme)} alt="" aria-hidden="true" draggable={false} decoding="async" className="absolute inset-0 w-full h-full object-cover object-left-top select-none" />
    {s.film(r.id) && (
      <video
        key={s.tag(r.id)}
        ref={el => s.hold(r.id, el)}
        src={filmFor(r.path, s.theme)}
        poster={stillFor(r.path, s.theme)}
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        onLoadedData={e => s.canPlay(s.tag(r.id), i, e.currentTarget)}
        onCanPlay={e => s.canPlay(s.tag(r.id), i, e.currentTarget)}
        onPlaying={e => s.canPlay(s.tag(r.id), i, e.currentTarget)}
        onSeeked={e => s.canPlay(s.tag(r.id), i, e.currentTarget)}
        onError={() => s.broke(r.id)}
        className={`absolute inset-0 w-full h-full object-cover object-left-top select-none transition-opacity duration-500 ${s.ready.has(s.tag(r.id)) ? 'opacity-100' : 'opacity-0'}`}
        data-wall-film={r.id}
      />
    )}
  </span>
);

/** The card's face: its bar (the glyph, bare, and the name) over its screen */
const Face = ({ r, i, s }: { r: WallRoom; i: number; s: Screens }) => (
  <>
    <span className="shrink-0 h-7 px-2.5 flex items-center gap-2 border-b border-borderSubtle bg-panel">
      {r.glyph && <ProductGlyph name={r.glyph} size={14} bare className="shrink-0" />}
      <span className="min-w-0 truncate text-[12.5px] font-medium">{r.name}</span>
    </span>
    <Screen r={r} i={i} s={s} />
  </>
);

/** The words under the card in front: what kind of room, its line, its pages */
const Words = ({ r, className = '', style }: { r: WallRoom; className?: string; style?: CSSProperties }) => (
  <div aria-hidden="true" className={`pointer-events-none ${className}`} style={style}>
    {r.kind && <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-textMuted">{r.kind}</p>}
    {r.lead && <p className="mt-1.5 text-[14.5px] leading-snug text-textPrimary [text-wrap:balance] line-clamp-2">{r.lead}</p>}
    {/* its first four pages (Practice holds five rows; the fifth ran the words into the tour on a laptop) */}
    {!!r.rows?.length && <p className="mt-1.5 text-[12px] leading-snug text-textMuted line-clamp-2">{r.rows.slice(0, 4).map(x => x.title).join(' · ')}</p>}
  </div>
);

const CARD =
  'group relative flex w-full flex-col overflow-hidden rounded-[12px] border bg-canvas text-left text-textPrimary transition-[border-color] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver';
const said = (r: WallRoom) => `${r.name}${r.lead ? ` — ${r.lead}` : ''} See it in the tour.`;

/* ---- THE DOCK (a desk with a pointer that hovers) ----------------------------------------------------------------- */

/* THE ONE IN FRONT AND THE REST BEHIND (2026-10-02 — the owner, with a picture of a ring of faces, the one in the middle
   larger and lit: "i want them side by side but the main one comes out and the rest are in the back and you can move your
   cursor"). The eight stand side by side across the row; the one in front is full size, on top and lifted, the others
   step back — smaller, dimmer and tucked under their neighbours the further they are from it — and the pointer's place
   along the row is the one that comes out. Every card is the same box moved and scaled (a transform: nothing is laid out
   again while it moves). */
const Dock = ({ rooms, s, onPick, moving, still }: { rooms: WallRoom[]; s: Screens; onPick: (id: string) => void; moving: boolean; still: boolean }) => {
  const n = rooms.length;
  const row = useRef<HTMLDivElement | null>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const veils = useRef<(HTMLSpanElement | null)[]>([]);
  const words = useRef<(HTMLDivElement | null)[]>([]);
  const faces = useRef<(HTMLButtonElement | null)[]>([]);
  /* the row's width and the tallest the card in front may stand — measured before the first paint, so the row is laid out
     at its full height from its first frame and nothing below it jumps */
  const [box, setBox] = useState({ width: 0, tall: 360 });
  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, tall: Math.max(230, Math.min(420, window.innerHeight - ABOVE - WORDS - 24)) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  const big = box.width ? bigFor(box.width, box.tall) : 0;
  const cardH = big / ASPECT + BAR + 2;
  const wordsW = Math.min(big, 440);
  /* THE GEOMETRY THE PAINTER READS is always this render's: a step that began before a resize ends on the new row (it
     carried the old row's sizes to its last frame and left the cards where the old row had them) */
  const geo = useRef({ big, width: box.width, wordsW });
  geo.current = { big, width: box.width, wordsW };
  const stillRef = useRef(still);
  stillRef.current = still;

  /* WHERE THE FRONT STANDS (2026-10-02 — the owner: "if no cursor is on it make it switch to each one on its own as like a
     clean motion and then when the cursor is over it takes over"). Two ways it moves. ON ITS OWN it GLIDES: from where it
     stands to the next room in a set time, easing in and out (no tail that creeps on after it seems to have stopped), then
     rests a while on that room and glides on — there and back along the row. Under the pointer it FOLLOWS: the pointer's
     place is where it heads, closing most of the gap in a tenth of a second, from wherever the glide had got to. When the
     pointer leaves, the dock settles on the room nearest it, rests, and carries on by itself. Written to the page directly,
     a frame at a time, only while it moves. */
  const m = useRef({ f: 0, to: 0, from: 0, t0: 0, dur: 0, hand: false, raf: 0, last: 0, dir: 1, next: 0, pause: 0 });
  const paint = () => {
    const { f } = m.current;
    const g = geo.current;
    if (!g.width) return;
    const { s: sc, c } = rowAt(n, f, g.big, g.width);
    const front = frontOf(m.current);
    for (let i = 0; i < n; i++) {
      const d = Math.abs(i - f);
      const near = (sc[i] - BACK) / (1 - BACK);
      const card = cards.current[i];
      if (card) {
        card.style.transform = `translate3d(${c[i] - g.big / 2}px, ${-LIFT * near}px, 0) scale(${sc[i]})`;
        card.style.zIndex = String(stackOf(d, i === front));
      }
      const veil = veils.current[i];
      if (veil) veil.style.opacity = String(Math.min(0.62, Math.max(0, d - 0.15) * 0.34));
      const t = words.current[i];
      if (t) {
        t.style.opacity = String(Math.max(0, Math.min(1, 1 - d * 2.2)));
        t.style.transform = `translateX(${Math.max(0, Math.min(g.width - g.wordsW, c[i] - g.wordsW / 2))}px)`;
      }
      const face = faces.current[i];
      if (face) face.dataset.front = front === i ? 'true' : 'false';
    }
  };
  const tick = (now: number) => {
    const st = m.current;
    if (st.hand) {
      /* following the pointer: the same pace at any frame rate (a time constant, not a share of each frame) */
      const dt = Math.min(64, now - (st.last || now - 16));
      st.f += (st.to - st.f) * (1 - Math.exp(-dt / FOLLOW));
      if (Math.abs(st.to - st.f) < 0.002) st.f = st.to;
    } else {
      const p = Math.min(1, (now - st.t0) / st.dur);
      st.f = st.from + (st.to - st.from) * glide(p);
      if (p >= 1) st.f = st.to;
    }
    st.last = now;
    paint();
    st.raf = st.f === st.to ? 0 : requestAnimationFrame(tick);
    if (!st.raf && !st.hand) rest();
  };
  const run = () => {
    const st = m.current;
    if (stillRef.current) {
      st.f = st.to;
      paint();
      return;
    }
    if (!st.raf) {
      st.last = 0;
      st.raf = requestAnimationFrame(tick);
    }
  };
  /* the pointer heads it to `to` */
  const follow = (to: number) => {
    const st = m.current;
    window.clearTimeout(st.next);
    st.to = to;
    st.hand = true;
    run();
  };
  /* it glides to `to` by itself: a step's time, a little longer the further it goes */
  const glideTo = (to: number) => {
    const st = m.current;
    st.hand = false;
    st.from = st.f;
    st.to = to;
    st.t0 = performance.now();
    st.dur = Math.min(1500, GLIDE + 160 * Math.max(0, Math.abs(to - st.f) - 1));
    if (st.from === st.to) {
      rest();
      return;
    }
    run();
  };
  /* resting on a room: after REST (or `wait`), on to the next — there and back along the row */
  const rest = (wait?: number) => {
    const st = m.current;
    window.clearTimeout(st.next);
    if (!movingRef.current || st.hand) return;
    const ms = wait ?? (st.pause || REST);
    st.pause = 0;
    st.next = window.setTimeout(() => {
      if (st.hand || !movingRef.current) return;
      const at = Math.round(st.to);
      if (at + st.dir > n - 1 || at + st.dir < 0) st.dir = -st.dir;
      glideTo(at + st.dir);
    }, ms);
  };
  const movingRef = useRef(moving);
  movingRef.current = moving;
  /* the row laid out again when its width changes, where the front stands */
  useEffect(() => {
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, big]);
  useEffect(
    () => () => {
      cancelAnimationFrame(m.current.raf);
      window.clearTimeout(m.current.next);
      window.clearTimeout(settle.current);
    },
    [],
  );

  /* THE DOCK'S OWN STEP: while it is on screen and the tab in front and no one steering; it stops where it is when it
     leaves the screen and picks up from there when it comes back */
  useEffect(() => {
    const st = m.current;
    if (!moving) {
      window.clearTimeout(st.next);
      return;
    }
    if (!st.hand && !st.raf) rest(FIRST);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, n]);

  /* THE POINTER'S PLACE IS THE CARD IN FRONT: where along the row the card in front would stand under the pointer, found
     on the row itself (by halving), so the card that comes out is the one under the pointer even where the row is
     narrower than its box */
  const fAt = (x: number) => {
    const g = geo.current;
    const centre = (f: number) => {
      const { c } = rowAt(n, f, g.big, g.width);
      const i = Math.min(n - 2, Math.floor(f));
      return c[i] + (c[i + 1] - c[i]) * (f - i);
    };
    if (x <= centre(0)) return 0;
    if (x >= centre(n - 1)) return n - 1;
    let lo = 0;
    let hi = n - 1;
    for (let k = 0; k < 22; k++) {
      const mid = (lo + hi) / 2;
      if (centre(mid) < x) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  /* the card the pointer has: kept until the pointer is well past the half-way to the next, so a hand at the border of two
     never swings the row between them; a pointer that stops brings its card all the way out — full size, on top, its words
     under it — and one that moves carries the row with it (where less motion is asked for, it changes card by card) */
  const pick = useRef(0);
  const settle = useRef(0);
  const fromPointer = (clientX: number) => {
    const el = row.current;
    if (!el || !geo.current.width) return;
    const raw = fAt(clientX - el.getBoundingClientRect().left);
    if (Math.abs(raw - pick.current) > 0.6) pick.current = Math.round(raw);
    window.clearTimeout(settle.current);
    if (stillRef.current) {
      if (!m.current.hand || m.current.to !== pick.current) follow(pick.current);
      return;
    }
    follow(raw);
    settle.current = window.setTimeout(() => follow(pick.current), SETTLE);
  };
  /* let go: a card the keys are on keeps the front; otherwise the dock settles on the room nearest it, rests a little
     longer than usual, then moves on by itself */
  const letGo = () => {
    window.clearTimeout(settle.current);
    const k = faces.current.findIndex(face => face?.matches(':focus-visible'));
    if (k >= 0) {
      follow(k);
      return;
    }
    const st = m.current;
    st.pause = WAIT;
    glideTo(Math.round(st.f));
  };

  /* the first frame is laid out where the front stands, so nothing flashes stacked at the left before the first paint */
  const lay = box.width ? rowAt(n, m.current.f, big, box.width) : null;
  const at = (i: number) => {
    if (!lay) return {};
    const d = Math.abs(i - m.current.f);
    return { transform: `translate3d(${lay.c[i] - big / 2}px, ${-LIFT * ((lay.s[i] - BACK) / (1 - BACK))}px, 0) scale(${lay.s[i]})`, zIndex: stackOf(d, i === frontOf(m.current)) };
  };
  return (
    <div
      ref={row}
      className="relative"
      style={{ height: cardH + LIFT + WORDS }}
      onPointerMove={e => e.pointerType === 'mouse' && fromPointer(e.clientX)}
      onPointerLeave={e => e.pointerType === 'mouse' && letGo()}
      data-landing-wall="dock"
    >
      {box.width > 0 &&
        rooms.map((r, i) => (
          <div
            key={r.id}
            ref={el => {
              cards.current[i] = el;
            }}
            className="absolute left-0 origin-bottom will-change-transform"
            style={{ width: big, bottom: WORDS, ...at(i) }}
          >
            <div className="landing-rise" style={{ ['--rise-delay' as string]: `${240 + i * 45}ms` }}>
              <button
                ref={el => {
                  faces.current[i] = el;
                }}
                type="button"
                onClick={() => onPick(r.id)}
                onFocus={() => follow(i)}
                onBlur={letGo}
                aria-label={said(r)}
                className={`${CARD} border-borderMuted shadow-[0_18px_50px_-24px_rgb(0_0_0/0.55)] data-[front=true]:border-textPrimary/45 hover:border-textPrimary/45`}
                data-front={i === 0 ? 'true' : 'false'}
                data-wall-room={r.id}
              >
                <Face r={r} i={i} s={s} />
                {/* a card at the back is dimmed by a veil of the page's own ground (an opacity) */}
                <span
                  ref={el => {
                    veils.current[i] = el;
                  }}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-canvas"
                  style={{ opacity: Math.min(0.62, Math.max(0, Math.abs(i - m.current.f) - 0.15) * 0.34) }}
                />
              </button>
            </div>
          </div>
        ))}
      {box.width > 0 &&
        rooms.map((r, i) => (
          <div
            key={`w-${r.id}`}
            ref={el => {
              words.current[i] = el;
            }}
            className="absolute left-0 bottom-0"
            style={{ width: wordsW, height: WORDS, opacity: i === 0 ? 1 : 0, transform: lay ? `translateX(${Math.max(0, Math.min(box.width - wordsW, lay.c[i] - wordsW / 2))}px)` : undefined }}
          >
            <Words r={r} className="pt-3.5" />
          </div>
        ))}
    </div>
  );
};

/* ---- THE STRIP (a phone, or a screen that is touched) ------------------------------------------------------------- */

const Strip = ({ rooms, s, onPick, moving, still }: { rooms: WallRoom[]; s: Screens; onPick: (id: string) => void; moving: boolean; still: boolean }) => {
  const n = rooms.length;
  const strip = useRef<HTMLDivElement | null>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  /* the screens (the buttons): they step back, not the words under them — a card scaled whole sank its screen into the
     front card's words */
  const screens = useRef<(HTMLButtonElement | null)[]>([]);
  const words = useRef<(HTMLDivElement | null)[]>([]);
  const veils = useRef<(HTMLSpanElement | null)[]>([]);
  /* THE CARD IN THE MIDDLE IS IN FRONT: each card stands a little smaller the further it is from the middle, and only the
     one in front shows its words — read off the scroll, a frame at a time while it moves */
  const raf = useRef(0);
  const shape = () => {
    raf.current = 0;
    const el = strip.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    /* every card's place read first, then every style written: one layout read a frame, not one a card */
    const ds = cards.current.map(c => (c ? Math.min(2, Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) / c.offsetWidth) : 2));
    for (let i = 0; i < n; i++) {
      const c = cards.current[i];
      if (!c) continue;
      const d = ds[i];
      const b = screens.current[i];
      if (b) b.style.transform = `scale(${1 - 0.2 * Math.min(1, d)})`;
      c.style.zIndex = String(100 - Math.round(d * 20));
      const v = veils.current[i];
      if (v) v.style.opacity = String(Math.min(0.55, d * 0.5));
      const t = words.current[i];
      if (t) t.style.opacity = String(Math.max(0, 1 - d * 2.4));
    }
  };
  const reshape = () => {
    if (!raf.current) raf.current = requestAnimationFrame(shape);
  };
  useEffect(() => {
    shape();
    window.addEventListener('resize', reshape);
    return () => {
      window.removeEventListener('resize', reshape);
      cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* the strip steps on by itself, a room every rest and glide, there and back; a thumb takes it over, and it carries on by
     itself a while after the thumb lets go */
  const heldUntil = useRef(0);
  const dir = useRef(1);
  useEffect(() => {
    if (!moving) return;
    const id = window.setInterval(() => {
      const el = strip.current;
      if (!el || performance.now() < heldUntil.current) return;
      const mid = el.scrollLeft + el.clientWidth / 2;
      let at = 0;
      cards.current.forEach((c, i) => {
        if (c && Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < c.offsetWidth / 2) at = i;
      });
      if (at + dir.current > n - 1 || at + dir.current < 0) dir.current = -dir.current;
      const next = cards.current[at + dir.current];
      if (next) el.scrollTo({ left: next.offsetLeft + next.offsetWidth / 2 - el.clientWidth / 2, behavior: 'smooth' });
    }, REST + GLIDE);
    return () => window.clearInterval(id);
  }, [moving, n]);
  const hold = () => {
    heldUntil.current = performance.now() + WAIT * 2;
  };
  /* THE KEYS OR A SCREEN READER on a card: the strip stops stepping while they are in it and brings that card to the middle,
     in front (it stepped on under a focused card and carried it off screen) */
  const focusCard = (i: number) => {
    heldUntil.current = Infinity;
    const c = cards.current[i];
    const el = strip.current;
    if (c && el) el.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - el.clientWidth / 2, behavior: still ? 'auto' : 'smooth' });
  };

  /* ONLY THE FILMS ON SCREEN PLAY: a card scrolled out of the strip pauses its film (and the neighbour just out of
     sight is kept ready) */
  useEffect(() => {
    const el = strip.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      es =>
        es.forEach(e => {
          const i = cards.current.indexOf(e.target as HTMLDivElement);
          if (i >= 0) s.seenIn(rooms[i].id, e.isIntersecting);
        }),
      { root: el, rootMargin: '0px 25%', threshold: 0 },
    );
    cards.current.forEach(c => c && io.observe(c));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="-mx-4 sm:-mx-6">
      <div
        ref={strip}
        onScroll={reshape}
        onTouchStart={hold}
        onPointerDown={hold}
        /* a sideways wheel (or Shift and the wheel) is a hand on the strip; the page's own scroll passing over it is not */
        onWheel={e => (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) && hold()}
        onBlur={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) heldUntil.current = performance.now() + WAIT * 2;
        }}
        /* pt-1.5 with -mt-1.5: room inside the scroll box for the top of a focused card's ring */
        className="flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-[calc(50%-min(37vw,165px))] pt-1.5 -mt-1.5 pb-1"
        data-landing-wall="strip"
      >
        {rooms.map((r, i) => (
          <div
            key={r.id}
            ref={el => {
              cards.current[i] = el;
            }}
            /* the cards overlap (a negative margin), the one in front on top: the strip's depth */
            className="relative snap-center shrink-0 w-[min(74vw,330px)] -mx-[7vw] first:ml-0 last:mr-0"
          >
            <div className="landing-rise" style={{ ['--rise-delay' as string]: `${240 + i * 45}ms` }}>
              <button
                ref={el => {
                  screens.current[i] = el;
                }}
                type="button"
                onClick={() => onPick(r.id)}
                onFocus={() => focusCard(i)}
                aria-label={said(r)}
                className={`${CARD} origin-bottom border-borderMuted`}
                data-wall-room={r.id}
              >
                <Face r={r} i={i} s={s} />
                <span
                  ref={el => {
                    veils.current[i] = el;
                  }}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-canvas"
                  style={{ opacity: i === 0 ? 0 : 0.5 }}
                />
              </button>
            </div>
            <div
              ref={el => {
                words.current[i] = el;
              }}
              style={{ opacity: i === 0 ? 1 : 0 }}
            >
              <Words r={r} className="pt-3 px-0.5 min-h-[92px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---- THE WALL: the films for either form ---------------------------------------------------------------------------- */

const Wall = ({ rooms, theme, onPick }: { rooms: WallRoom[]; theme: Theme; onPick: (id: string) => void }) => {
  const calm = useReducedMotion();
  const [frugal] = useState(savingData);
  /* a screen whose film will not play shows its still from then on */
  const [stills, setStills] = useState<Set<string>>(() => new Set());
  const motion = !calm && !frugal;
  /* A TURN OF THEME mounts every film anew (each is keyed by its theme), and `turn` counts the turns: a film back on a
     theme it played before is sent into itself and waits to draw again, like a new one. Keyed by the theme alone, the
     second turn found all eight already "sent" and "ready", and they set off together from their first frames, in step. */
  const [turn, setTurn] = useState({ theme, n: 0 });
  if (turn.theme !== theme) setTurn({ theme, n: turn.n + 1 });
  /* a pointer that hovers, on a screen wide enough for the row: the dock; anything else, the strip (from 768 px — below the
     wide desk a mouse had the strip, which it could not scroll) */
  const desk = useMatch('(hover: hover) and (pointer: fine) and (min-width: 768px)');
  /* the form is in the tag too: crossing from the strip to the dock mounts every film anew, and each must be sent into
     itself again or the eight set off in step */
  const tag = (id: string) => `${id}-${theme}-${turn.n}-${desk ? 'dock' : 'strip'}`;

  const wall = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = wall.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const [front, setFront] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  useEffect(() => {
    const on = () => setFront(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  const rolling = motion && seen && front;
  const rollingRef = useRef(rolling);
  rollingRef.current = rolling;

  const videos = useRef(new Map<string, HTMLVideoElement>());
  /* the cards the strip has scrolled out of sight: their films rest (the dock shows all eight) */
  const away = useRef(new Set<string>());
  const playIf = (id: string, v: HTMLVideoElement) => {
    if (rollingRef.current && !away.current.has(id)) v.play().catch(() => {});
    else v.pause();
  };
  useEffect(() => {
    if (desk) away.current.clear();
    for (const [id, v] of videos.current) playIf(id, v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolling, theme, desk]);
  /* the other theme's stills, fetched once the wall has been on screen a while — a theme turn then shows its screens at
     once instead of blank slabs while they load */
  useEffect(() => {
    if (!seen) return;
    const other: Theme = theme === 'dark' ? 'light' : 'dark';
    const id = window.setTimeout(() => {
      for (const r of rooms) {
        const im = new Image();
        im.decoding = 'async';
        im.src = stillFor(r.path, other);
      }
    }, 4000);
    return () => window.clearTimeout(id);
  }, [seen, theme, rooms]);
  /* A FILM SHOWS WHEN IT CAN PLAY: until then the still is the screen (a video that has not drawn its first frame is a
     black box over it — measured, half the wall black for the first seconds). Each one is first sent a little way into
     itself, so the wall never ticks in step; the seek is made once the film can be read there. */
  const sent = useRef(new Set<string>());
  const [ready, setReady] = useState<Set<string>>(() => new Set());
  const canPlay = (k: string, i: number, v: HTMLVideoElement) => {
    if (!sent.current.has(k)) {
      sent.current.add(k);
      const at = v.duration ? (i / rooms.length) * v.duration : 0;
      if (at > 0.05 && Math.abs(v.currentTime - at) > 0.25) {
        v.currentTime = at;
        return;
      }
    }
    playIf(rooms[i].id, v);
    setReady(r => (r.has(k) ? r : new Set(r).add(k)));
  };

  const s: Screens = {
    theme,
    seenIn: (id, on) => {
      if (on) away.current.delete(id);
      else away.current.add(id);
      const v = videos.current.get(id);
      if (v) playIf(id, v);
    },
    film: id => motion && !stills.has(`${id}-${theme}`),
    tag,
    ready,
    hold: (id, el) => {
      if (el) videos.current.set(id, el);
      else videos.current.delete(id);
    },
    canPlay,
    broke: id => setStills(st => new Set(st).add(`${id}-${theme}`)),
  };

  return (
    <div ref={wall} data-theme={theme} data-landing-wall-ground>
      {desk ? <Dock rooms={rooms} s={s} onPick={onPick} moving={rolling} still={!!calm} /> : <Strip rooms={rooms} s={s} onPick={onPick} moving={rolling} still={!!calm} />}
    </div>
  );
};

export default Wall;
