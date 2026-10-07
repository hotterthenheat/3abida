/*
==================================================
  SLAYER TERMINAL - ONE SESSION, AS THE TERMINAL SAW IT
  (pages/landing/Session.tsx)

  THE LANDING'S DEMONSTRATION (2026-10-03 — the owner's
  brief for the rebuilt landing: "Take one real
  historical market situation … Before … Positioning
  changes … Key level changes … Compass updates … Price
  interacts with the level … The point is not to claim
  'Slayer predicted the move.' The point is: 'Look at
  what the terminal was able to show.'").

  WHAT IT IS: one run of the terminal's own Pulse desk,
  a picture at a time (scripts/make-landing-session.mjs):
  the desk opened at 09:31 on its day and run forward,
  and at every step a reading — the price, the walls,
  the flip, Compass's top cards — and a picture of the
  desk as it stood. Five of the readings are beats, and
  three of them are on the page (PICK),
  and every word of a beat is read off its picture
  (session.json keeps the readings beside the frames).
  No date is printed: the terminal runs on its own data
  until a feed is connected, and the beats take a day's
  date when they are taken from a real one.

  THE SCROLL IS THE CLOCK (a desk): the window stands
  while the beats pass beside it, and between two beats
  it plays the session forward through every picture in
  between — the reader's scroll is the playhead. At a
  beat it holds: the beat's own full-size picture over
  the run's, and a hairline round what changed. On a
  phone each beat carries its own picture, framed on
  what changed. Where less motion is asked for, a beat
  changes the picture at once.

  THE COST: the run's pictures are fetched only when the
  reader comes near (the beats' first), drawn on one
  canvas only when the step on screen changes, and the
  scroll is read only while the section is on screen.

  THE STORY (a desk — since v5, 2026-10-05, the
  opening's): the terminal the opening draws out of a
  silver line comes to stand as THIS window
  (Opening.tsx `story`): the window stands hidden while
  it comes, takes over on its own first picture, and
  what the session says first (`story.lead`) stands
  beside it before the beats come up. A phone, or less
  motion, has the head and the beats.
==================================================
*/

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Theme } from '../../theme/theme';
import ProductGlyph from '../../brand/ProductGlyph';
import { useStacked } from './scale';
import { Prompt } from './TerminalWindow';
import SESSION from './session.json';
import { pictureIn } from './pixels';

type Box = [number, number, number, number];
interface Beat {
  step: number;
  time: string;
  boxes: Box[];
  /** what a held beat's window shows: the ladder round the level its words name (scripts/make-landing-session.mjs FOCUS) */
  focus: Box;
  /** the ladder's row for that level, and the chip's words, read off the run */
  level?: Box;
  call?: string;
}
const DATA = SESSION as unknown as { w: number; h: number; frames: number; times: string[]; beats: Beat[] };

/* THE BEATS' WORDS — each read off its picture (session.json `readings`): a new run of the session takes new words */
const ALL_WORDS: { title: string; text: string }[] = [
  { title: 'Before', text: 'SPY is at 470.29. Overhead sits the heaviest call positioning on the board: the call wall at 475.' },
  { title: 'Positioning shifts', text: 'SPY climbs to 474.04, and the book turns under it: the heaviest strike swings from the 475 calls to the 470 puts.' },
  { title: 'Compass updates', text: 'At 474.82, a breath under the wall, the SPY 475 call becomes Compass’s top pick.' },
  { title: 'The level moves', text: 'SPY trades through 475, and the call wall steps up to 477.' },
  { title: 'Price meets the level', text: '475 turns from ceiling to floor. The put wall moves up to it at 12:22, and price keeps coming back to it.' },
];
/* THREE OF THE FIVE (v5, 2026-10-05 — a shorter page): the wall overhead, price through it, and the level it left
   behind becoming the floor. The other two stay in session.json, and the scroll still plays their pictures on the way. */
const PICK = [0, 3, 4];
const BEATS = PICK.map(i => DATA.beats[i]);
const WORDS = PICK.map(i => ALL_WORDS[i]);
const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five'][BEATS.length] ?? String(BEATS.length);
/** the moment the window opens on: the first beat's (the opening's own window wears it, Opening.tsx) */
export const FIRST_TIME = DATA.times[BEATS[0].step] ?? BEATS[0].time;

const frameSrc = (theme: Theme, i: number) => `/landing/session/${theme}/f${String(i).padStart(3, '0')}.webp`;
/** a beat's own picture, full size — the page's beat k is the run's beat PICK[k] (the files are numbered by the run's five:
    numbered by the page's three, the second and third beats showed 11:06 and 11:12, where the call wall still stood at
    475) */
export const beatSrc = (theme: Theme, k: number) => `/landing/session/${theme}/beat-${PICK[k] + 1}.webp`;
/** …and its focus, cut at three times its size: sharp on any screen */
const focusSrc = (theme: Theme, k: number) => `/landing/session/${theme}/beat-${PICK[k] + 1}-focus.webp`;

/** where on the screen a beat's first line is when it is reached: a little under the middle */
const AT = 0.62;
const ease = (t: number) => t * t * (3 - 2 * t);
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/** THE CALL ON THE LEVEL (2026-10-06 — the owner's directive: "replace the hairline Marks with a 2 px silver rule on the
    exact level and a label chip, for example 'Call wall 475 → 477'"): a silver rule under the ladder's row for the level
    the beat's words name, and the chip — its words read off the run (session.json `call`) — standing on the row's strike,
    which it names: at the end of the row it covered the next row's figures. Laid in the picture's own measure: `frame` is
    the part of the 1440 × 1000 desk the window shows. */
const Callout = ({ beat, on, frame }: { beat: Beat; on: boolean; frame: Box }) => {
  if (!beat.level || !beat.call) return null;
  const [fx, fy, fw, fh] = frame;
  const [lx, ly, lw, lh] = beat.level;
  const left = Math.max(0, lx - fx);
  const right = Math.min(fw, lx + lw - fx);
  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none transition-opacity duration-300 motion-reduce:transition-none" style={{ opacity: on ? 1 : 0 }} data-session-call>
      <span className="absolute h-[2px] -translate-y-1/2 rounded-full bg-silver" style={{ top: pct(ly + lh + 1 - fy, fh), left: pct(left, fw), width: pct(Math.max(0, right - left), fw) }} />
      <span
        className="absolute -translate-y-1/2 rounded-full border border-silver bg-panel px-2.5 py-1 text-[0.75rem] font-medium leading-none tnum text-textPrimary whitespace-nowrap"
        style={{ top: pct(ly + lh / 2 - fy, fh), left: `calc(${pct(left, fw)} - 0.25rem)` }}
      >
        {beat.call}
      </span>
    </div>
  );
};

/** THE WINDOW'S CHROME, as TerminalWindow draws it: the terminal's glyph, the prompt that opened the desk (typed as the
    window comes in — in the story, by the opening's window, which this one takes over), and — at its right — the moment
    of the session on screen */
export const Bar = ({ time, typed = true, still = false }: { time: string; typed?: boolean; still?: boolean }) => (
  <div className="relative shrink-0 h-10 pl-3.5 pr-4 flex items-center gap-2.5 border-b border-borderSubtle bg-panel">
    <ProductGlyph name="terminal" size={16} bare className="shrink-0 size-[1rem]" />
    {typed && <Prompt path="/pulse" still={still} />}
    <span className="ml-auto pl-4 font-code text-[0.71875rem] tnum text-textMuted whitespace-nowrap" data-session-time>
      SPY · {time}
    </span>
  </div>
);

/** ON A PHONE, A BEAT WITH NO LEVEL: its own picture, framed on what changed (with room round it), in the window's chrome */
const framing = (boxes: Box[]): Box => {
  const x0 = Math.min(...boxes.map(b => b[0])) - 48;
  const y0 = Math.min(...boxes.map(b => b[1])) - 48;
  const x1 = Math.max(...boxes.map(b => b[0] + b[2])) + 48;
  const y1 = Math.max(...boxes.map(b => b[1] + b[3])) + 48;
  let w = x1 - x0;
  let h = y1 - y0;
  /* a frame a little wider than tall, as a phone's column likes */
  const want = 1.25;
  if (w / h > want) h = w / want;
  else w = h * want;
  w = Math.min(w, DATA.w);
  h = Math.min(h, DATA.h);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const x = Math.max(0, Math.min(DATA.w - w, cx - w / 2));
  const y = Math.max(0, Math.min(DATA.h - h, cy - h / 2));
  return [x, y, w, h];
};
/** ON A PHONE, A BEAT'S LEVEL CLOSE ENOUGH TO READ (2026-10-06 — the owner's directive: "on a phone, show each beat's
    framing() crop … with the P0 callout on it. Same 11 px minimum"): a cut of the desk from the level's strike, its row
    in the middle, as wide as keeps the ladder's 10 px figures at 11 px in the frame (325 × 200 of the desk in a 358 px
    column; narrower on a narrower phone), the 9 px column heads left above it — cut from the beat's focus (drawn at
    three times its size, so it stays sharp on a phone's screen) */
const NEAR_W = 325;
const NEAR_H = 200;
const SMALLEST = 10;
const READ_AT = 11;
const near = (beat: Beat, frameW: number): Box | null => {
  if (!beat.level) return null;
  const [fx, fy, fw, fh] = beat.focus;
  const [lx, ly, , lh] = beat.level;
  const w = Math.min(NEAR_W, (frameW * SMALLEST) / READ_AT);
  const h = (w * NEAR_H) / NEAR_W;
  const x = Math.max(fx, Math.min(fx + fw - w, lx - 8));
  const y = Math.max(fy, Math.min(fy + fh - h, ly + lh / 2 - h / 2));
  return [x, y, w, h];
};

const BeatPicture = ({ theme, k }: { theme: Theme; k: number }) => {
  const beat = BEATS[k];
  /* the frame's width, read before the first paint and again as it changes: the cut is chosen by it */
  const frame = useRef<HTMLDivElement | null>(null);
  const [frameW, setFrameW] = useState(358);
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => el.clientWidth && setFrameW(el.clientWidth);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const close = near(beat, frameW);
  const f = close ?? framing(beat.boxes);
  /* the picture the frame is cut from: the beat's focus, or the whole desk */
  const [bx, by, bw] = close ? beat.focus : [0, 0, DATA.w];
  return (
    <div className="mt-6 overflow-hidden rounded-[0.625rem] border border-borderMuted bg-canvas" data-theme={theme}>
      <Bar time={beat.time} />
      <div ref={frame} className="relative overflow-hidden" style={{ aspectRatio: `${f[2]} / ${f[3]}` }}>
        <img
          src={close ? focusSrc(theme, k) : beatSrc(theme, k)}
          alt={`The Pulse desk at ${beat.time}: ${WORDS[k].title.toLowerCase()}`}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute max-w-none select-none"
          style={{ width: pct(bw, f[2]), left: `-${pct(f[0] - bx, f[2])}`, top: `-${pct(f[1] - by, f[3])}` }}
        />
        <Callout beat={beat} on frame={f} />
      </div>
    </div>
  );
};

/** THE CAMERA (2026-10-06 — the owner's directive: "zoom each beat to what its copy talks about … Move between beats with
    an eased, triggered transition"): the window shows the desk through a camera — the whole desk (only while the
    opening hands its window over), or a beat's focus with its call: never zoomed on a level whose call is not up, so a
    window the session holds always reads at the page's 11 px and names what it shows. The scroll says WHEN the camera
    moves, never how far: reaching a beat starts a run on a timer, and a run plays whole. From one beat to the next the camera draws back to the whole desk
    while the session plays to the next beat's moment, and comes in on the level the next beat's words name. */
interface Pose {
  /** the part of the 1440 × 1000 desk on screen */
  cam: Box;
  /** the run's step drawn */
  step: number;
}
const FULL: Box = [0, 0, DATA.w, DATA.h];
const mixBox = (a: Box, b: Box, t: number): Box => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
/** the runs (ms): into a focus on one picture, from one beat to another, and back to the whole desk — each with the
    call's 300 ms fade after it inside the 1.5 s a reader's stop is held (a run of 1.3 s left a stop on a call at 95%) */
const ZOOM_MS = 800;
const PLAY_MS = 1100;
const BACK_MS = 400;
/** the camera `p` of the way along a run (a run that plays the session goes by the whole desk) */
const along = (from: Pose, to: Pose, p: number): Pose => {
  if (from.step === to.step) return { cam: mixBox(from.cam, to.cam, ease(p)), step: to.step };
  const cam = p < 0.3 ? mixBox(from.cam, FULL, ease(p / 0.3)) : p < 0.7 ? FULL : mixBox(FULL, to.cam, ease((p - 0.7) / 0.3));
  const q = ease(Math.min(1, Math.max(0, (p - 0.15) / 0.7)));
  return { cam, step: Math.round(from.step + (to.step - from.step) * q) };
};
/** where the camera goes for a beat (-1: the whole desk, on the first beat's moment — until the first beat is read) */
/* THE WHOLE DESK (2026-10-07 — the owner: "its the product videos and the text", too big): the camera no longer zooms
   into a beat's ladder (2026-10-06, the directive's "zoom each beat to what its copy talks about" — 1.4 times the desk at
   1440, more on a big screen); it stays on the whole desk and plays the session between the beats, and the call (the
   silver rule and its chip) stands on the level's row there */
const poseOf = (k: number): Pose => ({ cam: FULL, step: k < 0 ? BEATS[0].step : BEATS[k].step });

/** THE STAGE (a desk) */
interface View {
  /** the run's step on screen (the bar's time) */
  k: number;
  /** the beat being read */
  lit: number;
  /** not yet at the first beat: its words are not lit (in the story the session's first words stand beside the window),
      though the window is already on the first beat's level, its call up */
  pre: boolean;
  /** the beat the camera rests on — its focus up, sharp — or null while it moves or stands on the whole desk */
  rest: number | null;
}

/** THE STORY'S HOLD ON THIS WINDOW (a desk): the terminal the opening draws comes to stand here (Opening.tsx), so it
    hands the opening its window and its picture, and stands its first words beside it */
export interface Story {
  /** the window, standing on the right: hidden until the opening's terminal has come to stand where it is */
  stage: MutableRefObject<HTMLDivElement | null>;
  /** its picture, where the opening's picture comes to stand */
  screen: MutableRefObject<HTMLDivElement | null>;
  /** what the session says first, standing beside the window: in after the window */
  intro: MutableRefObject<HTMLDivElement | null>;
  /** the opening's terminal is on its way here: the session's own pictures may come */
  shown: boolean;
  /** the opening's own picture has gone: the window is the session's, and its camera is free to move */
  landed: boolean;
  /** the words beside the window, before the beats */
  lead: ReactNode;
}

/** the scroll the session's first words stand beside the window — the opening's run and a breath after it (svh); the
    words stand from a little above the screen's middle (PROLOGUE_AT) until their stretch is spent (112: the opening's run
    of 80 — Opening.tsx TRACK — and a breath of about 32 after it, the words standing alone) */
export const PROLOGUE = 112;
const PROLOGUE_AT = '24svh';

const Session = ({ theme, story }: { theme: Theme; story?: Story }) => {
  /* a phone, a tablet, or a screen taller than it is wide: each beat carries its own picture (scale.ts) */
  const small = useStacked();
  /* in the story (a desk): the window and the first words are the opening's to bring in */
  const told = !!story && !small;
  /* the camera stands on the whole desk until the opening's picture has gone */
  const landed = !told || story.landed;
  const calm = useReducedMotion();
  const wrap = useRef<HTMLDivElement | null>(null);
  const beatEls = useRef<(HTMLLIElement | null)[]>([]);
  const screen = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState<View>({ k: BEATS[0].step, lit: 0, pre: true, rest: told ? null : 0 });
  const viewNow = useRef(view);
  viewNow.current = view;

  /* ---- the pictures: fetched once the reader comes near, the beats' steps first ---- */
  const [near, setNear] = useState(false);
  const list = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    /* in the story the session starts right under the hero, so it is near from the first moment — it waits instead for
       its beats to come within a screen (the opening's run is ahead of them), and for the page's own first things to be in:
       its ninety pictures went out with the hero's and held it back */
    const el = told ? list.current : wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setNear(true);
    let io: IntersectionObserver | null = null;
    const watch = () => {
      io = new IntersectionObserver(
        ([e]) => {
          if (!e.isIntersecting) return;
          setNear(true);
          io?.disconnect();
        },
        { rootMargin: told ? '100% 0px' : '120% 0px' }
      );
      io.observe(el);
    };
    if (!told || document.readyState === 'complete') watch();
    else window.addEventListener('load', watch, { once: true });
    return () => {
      window.removeEventListener('load', watch);
      io?.disconnect();
    };
  }, [told]);
  /* …and the opening's terminal on its way here brings its pictures in whatever the page is still loading (the first is
     the opening's own picture, in already) */
  const shown = told && story.shown;
  useEffect(() => {
    if (shown) setNear(true);
  }, [shown]);
  /* the run's pictures, and the beats' own full-size ones (sharper where the camera stands on a beat's moment) */
  const imgs = useRef<(HTMLImageElement | null)[]>([]);
  const beatImgs = useRef<(HTMLImageElement | null)[]>(BEATS.map(() => null));
  /** the pose on the canvas, and the camera's own: where it stands, and the run it is on */
  const painted = useRef<{ pose: Pose; src: HTMLImageElement } | null>(null);
  const pose = useRef<Pose>(poseOf(told ? -1 : 0));
  const paint = useCallback((at: Pose, force = false) => {
    const c = canvas.current;
    if (!c) return;
    /* the beat's own picture where the step is a beat's; else the run's picture nearest the step that is in */
    const b = BEATS.findIndex(x => x.step === at.step);
    let src: HTMLImageElement | null = b >= 0 ? beatImgs.current[b] : null;
    if (!src) {
      for (let d = 0; d < DATA.frames && !src; d++) src = imgs.current[at.step - d] ?? imgs.current[at.step + d] ?? null;
    }
    if (!src) return;
    const was = painted.current;
    if (!force && was && was.src === src && was.pose.step === at.step && was.pose.cam.every((v, i) => Math.abs(v - at.cam[i]) < 0.05)) return;
    const g = c.getContext('2d');
    if (!g) return;
    const k = src.naturalWidth / DATA.w;
    const [x, y, w, h] = at.cam;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, x * k, y * k, w * k, h * k, 0, 0, c.width, c.height);
    painted.current = { pose: at, src };
  }, []);
  useEffect(() => {
    if (!near || small || calm) return;
    let alive = true;
    imgs.current = new Array(DATA.frames).fill(null);
    beatImgs.current = BEATS.map(() => null);
    painted.current = null;
    const order = [...new Set([...BEATS.map(b => b.step), ...Array.from({ length: DATA.frames }, (_, i) => i)])];
    let next = 0;
    const pull = () => {
      if (!alive || next >= order.length) return;
      const i = order[next++];
      const img = new Image();
      img.decoding = 'async';
      img.src = frameSrc(theme, i);
      pictureIn(img)
        .then(() => {
          if (!alive) return;
          imgs.current[i] = img;
          /* a picture nearer the step on screen than the one drawn goes up at once */
          const now = pose.current.step;
          const was = painted.current;
          if (!was || Math.abs(i - now) < Math.abs(imgs.current.indexOf(was.src) - now)) paint(pose.current, true);
        })
        .catch(() => {})
        .finally(pull);
    };
    for (let n = 0; n < 6; n++) pull();
    /* the beats' own pictures, full size, and their focus, ahead of being stood on */
    BEATS.forEach((_, k) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = beatSrc(theme, k);
      pictureIn(img).then(
        () => {
          if (!alive) return;
          beatImgs.current[k] = img;
          if (pose.current.step === BEATS[k].step) paint(pose.current, true);
        },
        () => {}
      );
    });
    return () => {
      alive = false;
    };
  }, [near, small, calm, theme, paint]);

  /* the canvas is as sharp as the screen it is on */
  useLayoutEffect(() => {
    const el = screen.current;
    const c = canvas.current;
    if (!el || !c) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      paint(pose.current, true);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [small, calm, paint]);

  /* ---- the scroll says which beat is being read; the camera goes there on a timer ---- */
  const landedNow = useRef(landed);
  landedNow.current = landed;
  const replace = useRef<() => void>(() => {});
  useEffect(() => {
    if (small) return;
    const el = wrap.current;
    if (!el) return;
    let anchors: number[] = [];
    const measure = () => {
      const vh = window.innerHeight;
      /* a beat is reached when its first line comes up to a little under the middle of the screen */
      anchors = beatEls.current.map(b => {
        const at = b?.querySelector('[data-session-anchor]') ?? b;
        return at ? at.getBoundingClientRect().top + window.scrollY - vh * AT : 0;
      });
    };
    let raf = 0;
    let seen = false;
    /** the beat the camera is going to (-1: the whole desk), and its run */
    let aim = told ? -1 : 0;
    let run: { from: Pose; to: Pose; t0: number; ms: number } | null = null;
    const show = (rest: number | null, lit: number, pre: boolean) => {
      const was = viewNow.current;
      const k = pose.current.step;
      if (was.k !== k || was.lit !== lit || was.pre !== pre || was.rest !== rest) setView({ k, lit, pre, rest });
    };
    let lit = 0;
    let pre = true;
    const tick = (now: number) => {
      raf = 0;
      if (run) {
        const p = Math.min(1, (now - run.t0) / run.ms);
        pose.current = along(run.from, run.to, p);
        if (!calm) paint(pose.current);
        if (p >= 1) {
          pose.current = run.to;
          run = null;
        }
      }
      show(run || aim < 0 ? null : aim, lit, pre);
      if (run) raf = requestAnimationFrame(tick);
    };
    const place = () => {
      if (!anchors.length) measure();
      const y = window.scrollY;
      const n = anchors.length;
      let i = 0;
      while (i < n - 1 && y >= anchors[i + 1]) i++;
      lit = i;
      pre = y < anchors[0];
      const want = landedNow.current ? i : -1;
      if (want !== aim) {
        aim = want;
        const to = poseOf(want);
        /* off screen, or where less motion is asked for: the camera is simply there */
        if (calm || !seen) {
          run = null;
          pose.current = to;
          if (!calm) paint(to, true);
        } else {
          const from = pose.current;
          /* back to the whole desk (the opening's picture is coming back over it) quickly */
          run = { from, to, t0: performance.now(), ms: want < 0 ? BACK_MS : from.step === to.step ? ZOOM_MS : PLAY_MS };
        }
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };
    replace.current = place;
    const onScroll = () => place();
    const onResize = () => {
      measure();
      place();
    };
    let listening = false;
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      if (e.isIntersecting && !listening) {
        listening = true;
        measure();
        window.addEventListener('scroll', onScroll, { passive: true });
        place();
      } else if (!e.isIntersecting && listening) {
        listening = false;
        window.removeEventListener('scroll', onScroll);
      }
    });
    io.observe(el);
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    window.addEventListener('resize', onResize);
    return () => {
      replace.current = () => {};
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [small, calm, paint, told]);
  /* the opening's picture gone (or back): the camera is told at once, not at the next scroll */
  useEffect(() => {
    replace.current();
  }, [landed]);

  const lit = view.lit;
  return (
    <div ref={wrap} className={small ? '' : 'grid grid-cols-[minmax(0,17rem)_minmax(0,1fr)] gap-x-10'} data-session>
      {/* the column ends just far enough under the last beat for the window to stay put while it is read (the beat is read
          at AT of the screen; the window lets go when the column's foot passes its own) — no empty screen after it */}
      <div className={small ? '' : 'pb-[2svh]'}>
        {told && (
          /* THE FIRST WORDS, beside the window: they stand from a little above the middle of the screen while the opening hands
             its window over and a breath after (hidden until then — Opening.tsx), then go up the page ahead of the beats */
          <div data-session-prologue>
            <div ref={story.intro} className="sticky" style={{ top: PROLOGUE_AT, opacity: 0, visibility: 'hidden' }} data-session-lead>
              {story.lead}
            </div>
            <div aria-hidden="true" style={{ height: `${PROLOGUE}svh` }} />
          </div>
        )}
        <ol ref={list} aria-label={`${COUNT} moments from the session`}>
          {BEATS.map((b, i) => {
            const on = small || (i === lit && !view.pre);
            return (
              <li
                key={b.step}
                ref={el => {
                  beatEls.current[i] = el;
                }}
                className={small ? 'py-6 border-t border-borderSubtle first:border-t-0' : 'min-h-[34svh] pt-[8svh]'}
                data-session-beat={i}
                data-on={on || undefined}
              >
                {/* the beat's time: the session's own sequence */}
                <p className={`text-[0.875rem] tnum transition-colors duration-300 ${on ? 'text-textPrimary' : 'text-textMuted'}`} data-session-anchor>
                  {b.time}
                </p>
                <h3 className={`mt-4 text-[1.625rem] sm:text-[1.75rem] xl:text-[1.875rem] landing-display font-light leading-[1.05] tracking-[-0.02em] transition-colors duration-300 ${on ? 'text-textPrimary' : 'text-textMuted'}`}>
                  {WORDS[i].title}
                </h3>
                <p className={`mt-3 max-w-[34ch] text-[0.96875rem] leading-[1.55] transition-colors duration-300 ${on ? 'text-textSecondary' : 'text-textMuted'}`}>{WORDS[i].text}</p>
                {small && <BeatPicture theme={theme} k={i} />}
              </li>
            );
          })}
        </ol>
        {/* said once, under the last beat */}
        <p className={`${small ? 'mt-2' : 'mt-10'} max-w-[34ch] text-[0.8125rem] leading-relaxed text-textMuted`} data-session-note>
          Read off the terminal at each moment, nothing added after. It shows what is there; it doesn’t predict what comes next.
        </p>
      </div>
      {!small && (
        <div
          ref={told ? story.stage : undefined}
          className="sticky top-[6rem] self-start h-[calc(100svh-8.25rem)] max-h-[53.75rem] flex justify-start"
          style={told ? { opacity: 0, visibility: 'hidden' } : undefined}
          data-session-stage
        >
          <div
            className="self-start overflow-hidden rounded-[0.625rem] border border-borderMuted bg-canvas flex flex-col"
            /* as large as the screen holds it whole under the bar: the picture under its bar (2.5rem) and its borders */
            style={{ width: `min(100%, calc((min(100svh - 8.25rem, 53.75rem) - 2.5rem - 2px) * ${DATA.w / DATA.h} + 2px))` }}
            data-theme={theme}
          >
            {/* in the story the opening's own window typed the prompt: this one takes it over already typed */}
            <Bar time={DATA.times[view.k] ?? BEATS[lit].time} still={told} />
            <div
              ref={el => {
                screen.current = el;
                if (told) story.screen.current = el;
              }}
              className="relative overflow-hidden"
              style={{ aspectRatio: `${DATA.w} / ${DATA.h}` }}
              data-session-rest={view.rest ?? undefined}
            >
              {!calm && <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 w-full h-full" />}
              {BEATS.map((b, i) => (
                <Callout key={b.step} beat={b} frame={FULL} on={i === lit && (calm ? true : view.rest === i)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Session;
