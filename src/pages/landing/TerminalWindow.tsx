/*
==================================================
  SLAYER TERMINAL - THE TERMINAL, IN A WINDOW
  (pages/landing/TerminalWindow.tsx)

  The picture on the landing page is the terminal
  itself (Noah, 2026-09-19: "i want the REAL thing
  from our website so it doesnt scream fake").

  FILMS, SINCE 2026-10-01. From 2026-09-19 the window
  held STILLS ("a static image breeds mystery and
  desire"); the owner, of them: "why are my photos just
  a photo and dont move so you cant see all the
  features my website offers?" So every page the tour
  names is FILMED from the real app
  (scripts/make-landing-clips.mjs): a sped-up stretch of
  someone actually using the desk, and nothing over it
  but their cursor (the owner, the same day: "it should
  just be a cursor make it a sped up version of you
  actually using the desk" — no words laid on the film,
  no pause button on the window).

  THE STILL STAYS UNDERNEATH. It is the film's first
  frame, shown at once; the film fades in over it when
  it can play, and ends on that frame again, so the two
  never jump. Where motion is not wanted the still is
  all there is: a visitor who asked their system for
  less motion, one saving data, a browser that cannot
  play the films — and a film plays only while the
  window is on screen and the tab is in front.

  ONE FILM PLAYS AT A TIME. When the tour asks for
  another page, the film on screen holds its frame
  until the next can play, then the next fades in over
  it. When the window turns theme (the same page), the
  other theme's film picks up at the same second, so
  the turn reads as one motion changing its ground.

  THE PICTURE'S SHAPE IS FIXED (1440 × 1000 on a desk),
  so the docked window takes that shape (Tour.tsx) and
  a picture is never cropped or stretched there. In one
  column the window is a fixed band and the picture
  fills it from its top left, the way a page sits in a
  window that is shorter than it.

  THE BAR IS A PROMPT (2026-10-03): it types the page it
  opens — "slayer:~ $ open pinpoint/map" — a letter at a
  time when the window turns to another page, the cursor
  after it blinking on the brand's beat. And as the new
  page lands, one band of light passes down the screen,
  once: the terminal drawing it. Neither where less
  motion is asked for.

  Motion here is the film itself — decoded, not painted
  by the page.
==================================================
*/

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Theme } from '../../theme/theme';
import Working from '../../components/ui/Working';
import ProductGlyph from '../../brand/ProductGlyph';
import CLIPS from './clips.json';
import Boot, { type Sweep } from './Boot';
import { pictureIn } from './pixels';

/** The desk picture's shape — what scripts/make-landing-shots.mjs and make-landing-clips.mjs photograph */
export const SHOT_W = 1440;
export const SHOT_H = 1000;
export const SHOT_ASPECT = SHOT_W / SHOT_H;
/** …and the phone's (scripts/landing-stage.mjs SIZES: a 390 × 760 screen) */
export const PHONE_W = 390;
export const PHONE_H = 760;

interface Props {
  /** The page the tour wants shown */
  path: string;
  /** The theme of the ground behind the window */
  theme: Theme;
  /** The landing is laid out for a desk: the desk's picture. Otherwise the terminal's phone layout, or the desk's on a tablet. */
  desk: boolean;
  /** Size the screen by the picture's own shape (a desk that does not dock). Otherwise the host gives the height. */
  natural?: boolean;
  /** A window further down the page fetches its picture and its film only once the reader comes near it */
  lazy?: boolean;
  /** THE BOOT (Boot.tsx): 'hero' — once a visit, as the page opens, its picture comes up over the window's ground;
      'switch' — as the window first comes into view, and again on every page (or theme) it switches to */
  boot?: 'hero' | 'switch';
  /** a switching window's boot: the way each page comes back sharp (Boot.tsx) */
  bootSweep?: Sweep;
  className?: string;
  /** THE PAGE HAS BEEN SEEN: the film on screen has played its lap (LAP seconds, or all of a shorter film; where the window
      shows stills, a still has stood that long) — the page it showed is named */
  onLap?: (path: string) => void;
  /** how far into its lap the film on screen is, and the lap's length, in seconds — as it plays (a still's lap is said
      once, with the time to glide over it) */
  onTime?: (at: number, length: number, glide?: number) => void;
  /** words at the right of the bar — the room's line while the window plays the hero's rooms */
  note?: string;
  /** HELD: the film waits on its first frame — a window that takes over from a picture drawn on a canvas (Rooms.tsx)
      shows that picture until it is on screen itself */
  hold?: boolean;
}

/* A SWITCH, BRISK (2026-10-05 — the owner: "we should have the tabs on the product things switch faster they take too
   long right now"): a switching window's page comes in in a third of a second (it was 520 ms) */
const SWITCH_RUN = 330;

/* A LAP, BRISK (2026-10-02 — the owner, of the tour's pages turning once a film had played through: "make the tab
   switching faster its so damn slow right now"): a page counts as seen after this much of its film (or the whole film, if
   shorter), and a still after the same while */
const LAP = 4.5;
const STILL_LAP = LAP * 1000;

/** A film's length, in seconds — what clips.json keeps for each page, theme and size */
interface Clip {
  d: number;
}
export const FILMS = CLIPS as unknown as Record<string, Clip>;

const crumbs = (pathname: string): string[] => pathname.split('/').filter(Boolean).slice(0, 3);
export const slug = (path: string): string => path.replace(/^\//, '').replace(/\//g, '-');
const keyFor = (path: string, theme: Theme, form: 'desk' | 'phone'): string => `${slug(path)}-${theme}-${form}`;
export const shotFor = (path: string, theme: Theme, form: 'desk' | 'phone'): string => `/landing/${keyFor(path, theme, form)}.webp`;
const filmFor = (key: string): string => `/landing/clips/${key}.mp4`;

/** The films are H.264: a browser that cannot play it (an open-source Chromium) is shown the stills */
const noFilms = (): boolean => typeof document !== 'undefined' && !document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"');

/** The windows on the page, each ready to fetch its page's still in the other theme; the theme button calls them as the
    reader reaches for it (pointer over it, or the keys on it), so a switch finds the pictures in */
const warmers = new Set<() => void>();
export const warmOtherGround = (): void => warmers.forEach(warm => warm());

/** A visitor saving data gets the stills */
export const savingData = (): boolean => {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!c?.saveData;
};

/** THE PROMPT: the command that opens the page on screen, typed a letter at a time each time the page changes (a stepped
    width in letters — the prompt's type is the one monospace), the cursor after it on the brand's beat (index.css
    .window-cursor: the mark's own keyframes, so brand/brandClock.ts pins it to the page's clock) */
export const Prompt = ({ path, still = false }: { path: string; still?: boolean }) => {
  const cmd = `open ${crumbs(path).join('/')}`;
  return (
    <span className="min-w-0 flex items-center font-code text-[0.71875rem] leading-none whitespace-nowrap" data-window-path={path}>
      <span className="text-textMuted">slayer:~ $</span>
      {/* `still`: the command already typed — a window taking over from another that typed it (Opening.tsx, Rooms.tsx) */}
      <span key={cmd} className={`${still ? '' : 'window-typing '}ml-[1ch] min-w-0 overflow-hidden text-textPrimary`} style={{ '--n': cmd.length } as CSSProperties}>
        {cmd}
      </span>
      <span aria-hidden="true" className="window-cursor ml-[0.125rem] shrink-0 w-[0.125rem] h-[1.15em]" />
    </span>
  );
};

interface Reel {
  key: string;
  path: string;
  form: 'desk' | 'phone';
  /** it can play: it is faded in over what was there */
  ready: boolean;
}

/** WHAT THE WINDOW SHOWS THIS MOMENT — the frame its film is on, else its still — for the page it switches to to come in
    over (Boot `from`): a switch starts from what the reader was looking at, not from the page's first frame */
const frameOf = (view: HTMLElement | null): HTMLCanvasElement | null => {
  if (!view || view.clientWidth < 1 || view.clientHeight < 1) return null;
  const films = [...view.querySelectorAll<HTMLVideoElement>('video[data-window-film]')].filter(v => v.readyState >= 2 && v.classList.contains('opacity-100'));
  const pic: CanvasImageSource | null = films[films.length - 1] ?? view.querySelector<HTMLImageElement>('img[data-window-shot]');
  if (!pic) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = Math.round(view.clientWidth * dpr);
  c.height = Math.round(view.clientHeight * dpr);
  try {
    c.getContext('2d')?.drawImage(pic, 0, 0, c.width, c.height);
  } catch {
    return null;
  }
  return c;
};

const TerminalWindow = ({ path, theme, desk, natural = false, className = '', onLap, onTime, note, lazy = false, boot, bootSweep, hold = false }: Props) => {
  const lapRef = useRef(onLap);
  lapRef.current = onLap;
  const timeRef = useRef(onTime);
  timeRef.current = onTime;
  const root = useRef<HTMLDivElement | null>(null);
  const view = useRef<HTMLDivElement | null>(null);
  /* a phone's column gets the terminal's phone layout; a tablet's is wide enough for the desk's picture. The first guess
     is the screen's (the column is the screen less its 16px gutters): guessing "desk" until measured, a phone fetched the
     desk's still and a megabyte of its film before turning to its own */
  const [narrow, setNarrow] = useState(() => !desk && typeof window !== 'undefined' && window.innerWidth - 32 < 560);
  useEffect(() => {
    const el = view.current;
    if (!el || desk) return setNarrow(false);
    const measure = () => setNarrow(el.clientWidth < 560);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [desk]);
  const form = narrow ? 'phone' : 'desk';

  /* A WINDOW FURTHER DOWN WAITS (2026-10-03, the rebuilt landing: a window to each of its products, a film in each): it
     fetches nothing until the reader is within a screen or so of it, and then keeps what it has */
  const [near, setNear] = useState(!lazy);
  useEffect(() => {
    if (near) return;
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: '90% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  const want = shotFor(path, theme, form);
  /* THE STILLS: `shown` is on screen; when the tour asks for another, it is decoded off screen and then laid over */
  const [shown, setShown] = useState<{ src: string; path: string } | null>(null);
  const [under, setUnder] = useState<string | null>(null);
  useEffect(() => {
    if (!near || shown?.src === want) return;
    let alive = true;
    const img = new Image();
    img.src = want;
    const land = () => {
      if (!alive) return;
      setUnder(shown?.src ?? null);
      setShown({ src: want, path });
    };
    pictureIn(img).then(land, land);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, near]);

  /* the other theme's still of this page, fetched as the reader reaches for the theme button (warmOtherGround) — not
     before: the page no longer turns on its own, most readers never switch, and every window fetched one it never showed */
  useEffect(() => {
    if (!near) return;
    let warmed = false;
    const warm = () => {
      if (warmed) return;
      warmed = true;
      new Image().src = shotFor(path, theme === 'dark' ? 'light' : 'dark', form);
    };
    warmers.add(warm);
    return () => {
      warmers.delete(warm);
    };
  }, [path, theme, form, near]);

  /* ---- THE FILMS ---- */
  const calm = useReducedMotion();
  const [frugal] = useState(savingData);
  /* a browser that cannot decode the films (an open-source Chromium without H.264) keeps the stills — asked once, up front.
     A film that fails to load leaves its own page on its still; the other pages keep their films (one failure used to
     turn every film off for the rest of the visit). */
  const [mute] = useState(noFilms);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const motion = near && !calm && !frugal && !mute;
  const key = keyFor(path, theme, form);
  const clip: Clip | undefined = broken.has(key) ? undefined : FILMS[key];

  const [reels, setReels] = useState<Reel[]>([]);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  useEffect(() => {
    if (!motion || !clip) {
      setReels([]);
      return;
    }
    /* (the film kept under the new one is never the new one itself: back to a page within the fade, the two shared a key) */
    setReels(cur => (cur[cur.length - 1]?.key === key ? cur : [...cur.filter(r => r.ready && r.key !== key).slice(-1), { key, path, form, ready: false }]));
  }, [key, motion, clip, path, form]);
  const live: Reel | undefined = reels[reels.length - 1];

  /* on screen, and the tab in front */
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const [front, setFront] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  useEffect(() => {
    const on = () => setFront(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  /* THE BOOT (Boot.tsx) shows the film's first frame: the film waits on it until the boot has gone. `booting` is the still
     being booted: the hero's from the start (Boot keeps it to once a visit); a switching window's as it is first seen,
     and each new page's as the window turns to it */
  const [booting, setBooting] = useState<string | null>(boot === 'hero' ? want : null);
  /* what was on screen as the window switched: its new page comes in over it (null the first time it is seen) */
  const bootFrom = useRef<HTMLCanvasElement | null>(null);
  const firstSeen = useRef(false);
  const lastWant = useRef(want);
  useEffect(() => {
    /* the page on screen is followed whether or not this change boots: a window that boots only some of its changes
       (Rooms.tsx — a row's, not the scroll's) never boots a page it already shows */
    if (want === lastWant.current) return;
    lastWant.current = want;
    if (boot !== 'switch' || calm) {
      /* a quiet change ends a boot still under way: the picture it was resolving is not the page any more */
      setBooting(null);
      return;
    }
    if (firstSeen.current) {
      bootFrom.current = frameOf(view.current);
      setBooting(want);
    }
  }, [want, boot, calm]);
  useEffect(() => {
    if (boot !== 'switch' || calm || !seen || firstSeen.current) return;
    firstSeen.current = true;
    bootFrom.current = null;
    setBooting(lastWant.current);
  }, [seen, boot, calm]);
  const holding = booting !== null && near;
  const rolling = !!live && seen && front && !holding && !hold;

  /* the film on screen plays; one going out holds its frame */
  useEffect(() => {
    for (const r of reels) {
      const v = videos.current.get(r.key);
      if (!v) continue;
      if (r.key === live?.key && rolling) v.play().catch(() => {});
      else v.pause();
    }
  }, [reels, live, rolling]);

  /* THE LAP: the film on screen reports how far into its lap it is as it plays, and says once, each time round, when the
     lap is played. Each film is read from its own start: a page shown again starts its count again. */
  const lastAt = useRef(new Map<string, number>());
  const lapped = useRef(new Set<string>());
  const played = (r: Reel, v: HTMLVideoElement) => {
    if (r.key !== live?.key) return;
    const d = v.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    const t = v.currentTime;
    const was = lastAt.current.get(r.key) ?? t;
    lastAt.current.set(r.key, t);
    /* round again: a new lap */
    if (was - t > d / 2) lapped.current.delete(r.key);
    const lap = Math.min(d, LAP);
    timeRef.current?.(Math.min(t, lap), lap);
    if (!lapped.current.has(r.key) && t >= lap - 0.15) {
      lapped.current.add(r.key);
      lapRef.current?.(r.path);
    }
  };
  /* …and a still that has stood a while counts as seen, where the window shows stills (data saved, or no films to play) */
  const stills = !reels.length;
  useEffect(() => {
    if (!stills || !shown || !seen || !front) return;
    const p = shown.path;
    const L = STILL_LAP / 1000;
    timeRef.current?.(0, L);
    const raf = requestAnimationFrame(() => timeRef.current?.(L, L, STILL_LAP));
    const id = window.setTimeout(() => lapRef.current?.(p), STILL_LAP);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(id);
    };
  }, [stills, shown, seen, front]);

  /* a film that can play fades in; when it has, the one under it goes */
  const ready = useCallback(
    (k: string) => {
      setReels(cur => cur.map(r => (r.key === k ? { ...r, ready: true } : r)));
      window.setTimeout(() => setReels(cur => (cur[cur.length - 1]?.key === k ? cur.filter(r => r.key === k) : cur)), 420);
    },
    []
  );
  /* THE TURN: the same page in the other theme picks up at the second the last one was at — read when the new film's
     length is known, and set again when it can play (a seek asked of a film not yet seekable is dropped) */
  const resume = useRef(new Map<string, number>());
  const metadata = useCallback(
    (r: Reel, v: HTMLVideoElement) => {
      const before = reels.find(o => o.key !== r.key && o.path === r.path && o.form === r.form);
      const was = before ? videos.current.get(before.key) : undefined;
      if (!was || !Number.isFinite(was.currentTime) || was.currentTime <= 0) return;
      const t = Math.min(was.currentTime, Math.max(0, v.duration - 0.05));
      resume.current.set(r.key, t);
      v.currentTime = t;
    },
    [reels]
  );
  const canPlay = useCallback(
    (r: Reel, v: HTMLVideoElement) => {
      const t = resume.current.get(r.key);
      if (t != null) {
        resume.current.delete(r.key);
        if (Math.abs(v.currentTime - t) > 0.25) v.currentTime = t;
      }
      if (!r.ready) ready(r.key);
    },
    [ready]
  );

  const here = shown?.path ?? path;

  /* THE PAGE IS DRAWN: when the page on top changes (a film faded in, or a still where there are no films), one band of
     light passes down the screen — not for the first page, nor for the same page turning theme */
  const onTop = [...reels].reverse().find(r => r.ready);
  const drawn = onTop?.path ?? shown?.path ?? null;
  const [sweep, setSweep] = useState(0);
  const lastDrawn = useRef<string | null>(null);
  useEffect(() => {
    if (!drawn || drawn === lastDrawn.current) return;
    const first = lastDrawn.current === null;
    lastDrawn.current = drawn;
    /* a switching window boots its new page instead (Boot.tsx) */
    if (!first && !calm && boot !== 'switch') setSweep(n => n + 1);
  }, [drawn, calm, boot]);

  return (
    <div ref={root} data-theme={theme} data-terminal-window={here} data-window-films={reels.length ? (rolling ? 'rolling' : 'held') : 'stills'} className={`landing-window relative flex flex-col overflow-hidden rounded-[0.625rem] border border-borderMuted bg-canvas text-textPrimary transition-[border-color,box-shadow] duration-500 ${className}`}>
      {/* THE BAR — the prompt that opened the page on screen; on the hero, the room's line beside it */}
      <div className="relative shrink-0 h-10 pl-3.5 pr-4 flex items-center gap-2.5 border-b border-borderSubtle bg-panel transition-colors duration-500">
        <ProductGlyph name="terminal" size={16} bare className="shrink-0 size-[1rem]" />
        {/* the page on top: a film still loading leaves the one before it on screen, and the prompt waits with it */}
        <Prompt path={drawn ?? here} />
        {note && (
          <span key={note} className="ml-auto pl-6 hidden md:block min-w-0 truncate text-[0.75rem] text-textMuted animate-fade-in" data-window-note>
            {note}
          </span>
        )}
      </div>

      {/* THE SCREEN */}
      <div ref={view} className={`relative overflow-hidden bg-canvas ${natural ? '' : 'flex-1 min-h-0'}`} style={natural ? { aspectRatio: form === 'phone' ? `${PHONE_W} / ${PHONE_H}` : `${SHOT_W} / ${SHOT_H}` } : undefined}>
        {under && <img src={under} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 w-full h-full object-cover object-left-top select-none" />}
        {shown && (
          <img
            key={shown.src}
            src={shown.src}
            alt={`The terminal's ${crumbs(shown.path).join(' ').replace(/-/g, ' ')} page`}
            draggable={false}
            onAnimationEnd={() => setUnder(null)}
            className="absolute inset-0 w-full h-full object-cover object-left-top select-none animate-fade-in"
            data-window-shot={shown.src}
          />
        )}
        {reels.map(r => (
          <video
            key={r.key}
            ref={el => {
              if (el) videos.current.set(r.key, el);
              else videos.current.delete(r.key);
            }}
            src={filmFor(r.key)}
            poster={shotFor(r.path, r.key.includes('-light-') ? 'light' : 'dark', r.form)}
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-label={`The terminal's ${crumbs(r.path).join(' ').replace(/-/g, ' ')} page, in use`}
            onLoadedMetadata={e => {
              /* a film loaded afresh counts from its own start */
              lastAt.current.delete(r.key);
              lapped.current.delete(r.key);
              metadata(r, e.currentTarget);
            }}
            onCanPlay={e => canPlay(r, e.currentTarget)}
            onTimeUpdate={e => played(r, e.currentTarget)}
            onError={() => setBroken(b => new Set(b).add(r.key))}
            className={`absolute inset-0 w-full h-full object-cover object-left-top select-none transition-opacity duration-300 ${r.ready ? 'opacity-100' : 'opacity-0'}`}
            data-window-film={r.key}
          />
        ))}
        {/* the first picture is still travelling: the house's "it is working" mark, and only if the wait lasts (ui/Working.tsx) */}
        {!shown && (
          <span className="absolute inset-x-0 top-0 h-[20rem] max-h-full flex items-center justify-center pointer-events-none" data-window-boot>
            <Working label="Loading the picture" stacked />
          </span>
        )}
        {/* a switch brings its page in over what was there; the hero's comes up once (Boot.tsx) */}
        {booting && near && (
          <Boot
            key={`boot:${booting}`}
            src={booting}
            replay={boot === 'switch'}
            run={boot === 'switch' ? SWITCH_RUN : undefined}
            start={boot === 'switch' ? 0 : undefined}
            sweep={boot === 'switch' ? bootSweep : undefined}
            from={bootFrom.current}
            onDone={() => setBooting(b => (b === booting ? null : b))}
          />
        )}
        {sweep > 0 && <span key={sweep} aria-hidden="true" className="window-sweep pointer-events-none absolute inset-0" />}
      </div>
    </div>
  );
};

export default TerminalWindow;
