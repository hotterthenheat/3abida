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
  endless loop: the idle step is a timer, and each step
  eases in and stops). Where less motion is asked for,
  the dock does not move by itself and the screens are
  stills; data saved, stills too. The glyph sits bare on
  the screen's bar: no box round any logo.
==================================================
*/

import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
/** the most a card overlaps the one beside it (the rest of the row's width is shared out so it always spans the row) */
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
/** what stands above the dock on a desk (the signature, the line, the words and the door, and their margins) */
const ABOVE = 434;

/** each card's size against the one in front, the card at `f` (an index, or between two) in front */
const scales = (n: number, f: number) => Array.from({ length: n }, (_, i) => BACK + (1 - BACK) * Math.exp(-(((i - f) / REACH) ** 2)));
/** THE ROW: each card's centre and size. The cards overlap, each tucked under the one nearer the front, and the overlap is
    whatever makes the row span its width exactly — so the card in front travels the row as `f` does, from the left end
    to the right one, and the ones behind fan out either side of it. */
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
  /* the row's width and the tallest the card in front may stand */
  const [box, setBox] = useState({ width: 0, tall: 360 });
  useEffect(() => {
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
    if (!box.width) return;
    const { s: sc, c } = rowAt(n, f, big, box.width);
    for (let i = 0; i < n; i++) {
      const d = Math.abs(i - f);
      const near = (sc[i] - BACK) / (1 - BACK);
      const card = cards.current[i];
      if (card) {
        card.style.transform = `translate3d(${c[i] - big / 2}px, ${-LIFT * near}px, 0) scale(${sc[i]})`;
        card.style.zIndex = String(100 - Math.round(d * 10));
      }
      const veil = veils.current[i];
      if (veil) veil.style.opacity = String(Math.min(0.62, Math.max(0, d - 0.15) * 0.34));
      const t = words.current[i];
      if (t) {
        t.style.opacity = String(Math.max(0, Math.min(1, 1 - d * 2.2)));
        t.style.transform = `translateX(${Math.max(0, Math.min(box.width - wordsW, c[i] - wordsW / 2))}px)`;
      }
      const face = faces.current[i];
      if (face) face.dataset.front = Math.round(f) === i ? 'true' : 'false';
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
    if (still) {
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

  /* the pointer's place along the row is the card in front: the front travels from the left end (half a card in) to the
     right end, so the pointer's place maps straight onto it */
  const fromPointer = (clientX: number) => {
    const el = row.current;
    if (!el || !box.width) return;
    const x = clientX - el.getBoundingClientRect().left;
    follow(Math.max(0, Math.min(n - 1, ((x - big / 2) / Math.max(1, box.width - big)) * (n - 1))));
  };
  /* let go: it settles on the room nearest it, rests a little longer than usual, then moves on by itself */
  const letGo = () => {
    const st = m.current;
    st.pause = WAIT;
    glideTo(Math.round(st.f));
  };

  /* the first frame is laid out where the front stands, so nothing flashes stacked at the left before the first paint */
  const lay = box.width ? rowAt(n, m.current.f, big, box.width) : null;
  const at = (i: number) => {
    if (!lay) return {};
    const d = Math.abs(i - m.current.f);
    return { transform: `translate3d(${lay.c[i] - big / 2}px, ${-LIFT * ((lay.s[i] - BACK) / (1 - BACK))}px, 0) scale(${lay.s[i]})`, zIndex: 100 - Math.round(d * 10) };
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
                {/* a card at the back is dimmed by a veil of the page's own ground (an opacity: nothing repaints) */}
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

const Strip = ({ rooms, s, onPick, moving }: { rooms: WallRoom[]; s: Screens; onPick: (id: string) => void; moving: boolean }) => {
  const n = rooms.length;
  const strip = useRef<HTMLDivElement | null>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
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
    for (let i = 0; i < n; i++) {
      const c = cards.current[i];
      if (!c) continue;
      const d = Math.min(2, Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) / c.offsetWidth);
      c.style.transform = `scale(${1 - 0.2 * Math.min(1, d)})`;
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

  return (
    <div className="-mx-4 sm:-mx-6">
      <div
        ref={strip}
        onScroll={reshape}
        onTouchStart={hold}
        onPointerDown={hold}
        onWheel={hold}
        className="flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-[calc(50%-min(37vw,165px))] pb-1"
        data-landing-wall="strip"
      >
        {rooms.map((r, i) => (
          <div
            key={r.id}
            ref={el => {
              cards.current[i] = el;
            }}
            /* the cards overlap (a negative margin), the one in front on top: the strip's depth */
            className="relative snap-center shrink-0 w-[min(74vw,330px)] -mx-[7vw] first:ml-0 last:mr-0 origin-bottom"
          >
            <div className="landing-rise" style={{ ['--rise-delay' as string]: `${240 + i * 45}ms` }}>
              <button type="button" onClick={() => onPick(r.id)} aria-label={said(r)} className={`${CARD} border-borderMuted`} data-wall-room={r.id}>
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
  const tag = (id: string) => `${id}-${theme}-${turn.n}`;

  /* a pointer that hovers, on a screen wide enough for the row: the dock; anything else, the strip */
  const desk = useMatch('(hover: hover) and (pointer: fine) and (min-width: 1024px)');

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

  const videos = useRef(new Map<string, HTMLVideoElement>());
  useEffect(() => {
    for (const v of videos.current.values()) {
      if (rolling) v.play().catch(() => {});
      else v.pause();
    }
  }, [rolling, theme, desk]);
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
    if (rolling) v.play().catch(() => {});
    setReady(r => (r.has(k) ? r : new Set(r).add(k)));
  };

  const s: Screens = {
    theme,
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
      {desk ? <Dock rooms={rooms} s={s} onPick={onPick} moving={rolling} still={!!calm} /> : <Strip rooms={rooms} s={s} onPick={onPick} moving={rolling} />}
    </div>
  );
};

export default Wall;
