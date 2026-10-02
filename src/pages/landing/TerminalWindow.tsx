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

  Motion here is the film itself — decoded, not painted
  by the page.
==================================================
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Theme } from '../../theme/theme';
import Working from '../../components/ui/Working';
import ProductGlyph from '../../brand/ProductGlyph';
import CLIPS from './clips.json';

/** The desk picture's shape — what scripts/make-landing-shots.mjs and make-landing-clips.mjs photograph */
export const SHOT_W = 1440;
export const SHOT_H = 1000;
export const SHOT_ASPECT = SHOT_W / SHOT_H;

interface Props {
  /** The page the tour wants shown */
  path: string;
  /** The theme of the ground behind the window */
  theme: Theme;
  /** The landing is laid out for a desk: the desk's picture. Otherwise the terminal's phone layout, or the desk's on a tablet. */
  desk: boolean;
  /** Size the screen by the picture's own shape (a desk that does not dock). Otherwise the host gives the height. */
  natural?: boolean;
  className?: string;
  /** THE PAGE HAS BEEN SEEN: the film on screen has played its lap (LAP seconds, or all of a shorter film; where the window
      shows stills, a still has stood that long) — the page it showed is named */
  onLap?: (path: string) => void;
  /** how far into its lap the film on screen is, and the lap's length, in seconds — as it plays (a still's lap is said
      once, with the time to glide over it) */
  onTime?: (at: number, length: number, glide?: number) => void;
}

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
const shotFor = (path: string, theme: Theme, form: 'desk' | 'phone'): string => `/landing/${keyFor(path, theme, form)}.webp`;
const filmFor = (key: string): string => `/landing/clips/${key}.mp4`;

/** The films are H.264: a browser that cannot play it (an open-source Chromium) is shown the stills */
const noFilms = (): boolean => typeof document !== 'undefined' && !document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"');

/** A visitor saving data gets the stills */
export const savingData = (): boolean => {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!c?.saveData;
};

interface Reel {
  key: string;
  path: string;
  form: 'desk' | 'phone';
  /** it can play: it is faded in over what was there */
  ready: boolean;
}

const TerminalWindow = ({ path, theme, desk, natural = false, className = '', onLap, onTime }: Props) => {
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

  const want = shotFor(path, theme, form);
  /* THE STILLS: `shown` is on screen; when the tour asks for another, it is decoded off screen and then laid over */
  const [shown, setShown] = useState<{ src: string; path: string } | null>(null);
  const [under, setUnder] = useState<string | null>(null);
  useEffect(() => {
    if (shown?.src === want) return;
    let alive = true;
    const img = new Image();
    img.src = want;
    const land = () => {
      if (!alive) return;
      setUnder(shown?.src ?? null);
      setShown({ src: want, path });
    };
    img.decode().then(land, land);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);

  /* the other theme's still of this page is fetched ahead: the window turns with the page, and the turn should not wait */
  useEffect(() => {
    const t = window.setTimeout(() => {
      new Image().src = shotFor(path, theme === 'dark' ? 'light' : 'dark', form);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [path, theme, form]);

  /* ---- THE FILMS ---- */
  const calm = useReducedMotion();
  const [frugal] = useState(savingData);
  /* a browser that cannot decode the films (an open-source Chromium without H.264) keeps the stills — asked once, up front.
     A film that fails to load leaves its own page on its still; the other pages keep their films (one failure used to
     turn every film off for the rest of the visit). */
  const [mute] = useState(noFilms);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const motion = !calm && !frugal && !mute;
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
  const rolling = !!live && seen && front;

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
  const parts = crumbs(here);

  return (
    <div ref={root} data-theme={theme} data-terminal-window={here} data-window-films={reels.length ? (rolling ? 'rolling' : 'held') : 'stills'} className={`landing-window relative flex flex-col overflow-hidden rounded-[14px] border border-borderMuted bg-canvas text-textPrimary transition-[border-color,box-shadow] duration-500 ${className}`}>
      {/* THE BAR — which page this is; nothing else */}
      <div className="relative shrink-0 h-10 pl-3.5 pr-3 flex items-center gap-1.5 sm:gap-3 border-b border-borderSubtle bg-panel font-mono transition-colors duration-500">
        <ProductGlyph name="terminal" size={16} bare />
        <span className="min-w-0 flex items-center gap-1.5 text-[11px] text-textSecondary truncate" data-window-path>
          <span className="text-textMuted hidden sm:inline">terminal</span>
          {parts.map((p, i) => (
            <span key={`${p}-${i}`} className="flex items-center gap-1.5 min-w-0">
              <span className="text-textMuted hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className={i === parts.length - 1 ? 'text-textPrimary font-semibold truncate' : 'text-textMuted truncate hidden sm:inline'}>{p.replace(/-/g, ' ')}</span>
            </span>
          ))}
        </span>
      </div>

      {/* THE SCREEN */}
      <div ref={view} className={`relative overflow-hidden bg-canvas ${natural ? '' : 'flex-1 min-h-0'}`} style={natural ? { aspectRatio: `${SHOT_W} / ${SHOT_H}` } : undefined}>
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
          <span className="absolute inset-x-0 top-0 h-[320px] max-h-full flex items-center justify-center pointer-events-none" data-window-boot>
            <Working label="Loading the picture" stacked />
          </span>
        )}
      </div>
    </div>
  );
};

export default TerminalWindow;
