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
  names is now FILMED from the real app
  (scripts/make-landing-clips.mjs): the page staged as
  its still was, then worked by a pointer — a strike
  hovered and its card read, a price dragged, a day
  opened — while the feed keeps moving under it. Each
  film says what it is showing in a line at its foot
  (clips.json: the words and when).

  THE STILL STAYS UNDERNEATH. It is the film's first
  frame, shown at once; the film fades in over it when
  it can play, and ends on that frame again, so the two
  never jump. Where motion is not wanted the still is
  all there is: a visitor who asked their system for
  less motion, one saving data, and one who pressed
  pause (kept on this machine) — and the film plays
  only while the window is on screen and the tab is in
  front.

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

  Motion here is the film itself (decoded, not painted
  by the page) and transforms: the progress line is a
  scaleX, nothing repaints per frame.

  EVERY ROOM IN TURN, UNDER THE HEADLINE (2026-10-01,
  the hero's rooms — Landing.tsx). While the window is
  the hero's, the host may ask to hear when a film has
  played through once (`onCycle`) and hand over a line
  to fill as it plays (`cycleBar`, the lit room's own):
  the room after it is then put in the window. Where the
  window shows stills because the browser cannot play
  the films, a still stands for a while instead. Never
  where the visitor asked for less motion, saves data,
  or pressed pause.
==================================================
*/

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
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
  /** THE HERO'S ROOMS: the film on screen has played through once (or a still has stood its while) — time for the next */
  onCycle?: () => void;
  /** …and a line of the host's to fill as it plays, by a transform */
  cycleBar?: RefObject<HTMLElement | null>;
}

/** How long a still stands for its room when the films cannot play, ms */
const STILL_STANDS = 7000;

interface Clip {
  /** seconds */
  d: number;
  /** the words, and the second each begins */
  c: [number, string][];
}
const FILMS = CLIPS as unknown as Record<string, Clip>;

const crumbs = (pathname: string): string[] => pathname.split('/').filter(Boolean).slice(0, 3);
const slug = (path: string): string => path.replace(/^\//, '').replace(/\//g, '-');
const keyFor = (path: string, theme: Theme, form: 'desk' | 'phone'): string => `${slug(path)}-${theme}-${form}`;
const shotFor = (path: string, theme: Theme, form: 'desk' | 'phone'): string => `/landing/${keyFor(path, theme, form)}.webp`;
const filmFor = (key: string): string => `/landing/clips/${key}.mp4`;

/* the visitor's pause, kept on this machine */
const HELD_KEY = 'slayer_landing_films';
const readHeld = (): boolean => {
  try {
    return localStorage.getItem(HELD_KEY) === 'held';
  } catch {
    return false;
  }
};
/* a visitor saving data gets the stills */
const savingData = (): boolean => {
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

const TerminalWindow = ({ path, theme, desk, natural = false, className = '', onCycle, cycleBar }: Props) => {
  const root = useRef<HTMLDivElement | null>(null);
  /* the host's callback and line, read when they are needed — a new one each render must not restart the film's reading */
  const cycle = useRef(onCycle);
  const cycleLine = useRef(cycleBar);
  useEffect(() => {
    cycle.current = onCycle;
    cycleLine.current = cycleBar;
  });
  const cycling = !!onCycle;
  const view = useRef<HTMLDivElement | null>(null);
  /* a phone's column gets the terminal's phone layout; a tablet's is wide enough for the desk's picture */
  const [narrow, setNarrow] = useState(false);
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
  const [held, setHeld] = useState(readHeld);
  const [frugal] = useState(savingData);
  /* a browser that cannot decode the films (an open-source Chromium without H.264) keeps the stills, with no controls */
  const [mute, setMute] = useState(false);
  const motion = !calm && !frugal && !mute;
  const key = keyFor(path, theme, form);
  const clip: Clip | undefined = FILMS[key];

  const [reels, setReels] = useState<Reel[]>([]);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  useEffect(() => {
    if (!motion || !clip) {
      setReels([]);
      return;
    }
    setReels(cur => (cur[cur.length - 1]?.key === key ? cur : [...cur.filter(r => r.ready).slice(-1), { key, path, form, ready: false }]));
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
  const rolling = !!live && seen && front && !held;

  /* the film on screen plays; one going out holds its frame */
  useEffect(() => {
    for (const r of reels) {
      const v = videos.current.get(r.key);
      if (!v) continue;
      if (r.key === live?.key && rolling) v.play().catch(() => {});
      else v.pause();
    }
  }, [reels, live, rolling]);

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

  /* THE WORDS AND THE LINE: read off the film on screen each frame it plays — the line is a transform, the words change
     only when the film reaches the next */
  const bar = useRef<HTMLSpanElement | null>(null);
  const [said, setSaid] = useState(-1);
  useEffect(() => {
    const v = live ? videos.current.get(live.key) : undefined;
    const words = live ? FILMS[live.key]?.c ?? [] : [];
    if (!v) {
      setSaid(-1);
      if (bar.current) bar.current.style.transform = 'scaleX(0)';
      return;
    }
    let raf = 0;
    let last = -2;
    /* where the film was at the last reading: a film that loops comes back to its start, and that is one pass played */
    let was = -1;
    const read = () => {
      const t = v.currentTime;
      if (bar.current && v.duration) bar.current.style.transform = `scaleX(${Math.min(1, t / v.duration)})`;
      const line = cycleLine.current?.current;
      if (line && v.duration) line.style.transform = `scaleX(${Math.min(1, t / v.duration)})`;
      if (was >= 0 && t + 0.5 < was && cycle.current) {
        was = -1;
        cycle.current();
      } else was = t;
      let i = -1;
      for (let k = 0; k < words.length; k++) if (words[k][0] <= t + 0.05) i = k;
      if (i !== last) {
        last = i;
        setSaid(i);
      }
      raf = rolling ? requestAnimationFrame(read) : 0;
    };
    read();
    return () => cancelAnimationFrame(raf);
  }, [live, rolling]);
  /* STILLS ONLY (the browser cannot play the films): in the hero a still stands its while, then the next room comes in.
     The lit room's line fills over that while by a transition — one transform, set once. */
  const standing = cycling && reels.length === 0 && !calm && !frugal && !held && seen && front && !!shown;
  useEffect(() => {
    if (!standing) return;
    const line = cycleLine.current?.current;
    if (line) {
      line.style.transition = 'none';
      line.style.transform = 'scaleX(0)';
      void line.offsetWidth;
      line.style.transition = `transform ${STILL_STANDS}ms linear`;
      line.style.transform = 'scaleX(1)';
    }
    const t = window.setTimeout(() => cycle.current?.(), STILL_STANDS);
    return () => {
      window.clearTimeout(t);
      if (line) {
        line.style.transition = '';
        line.style.transform = 'scaleX(0)';
      }
    };
  }, [standing, shown?.src]);

  const words = live && said >= 0 ? FILMS[live.key]?.c[said]?.[1] : null;

  const toggle = () => {
    const next = !held;
    setHeld(next);
    try {
      if (next) localStorage.setItem(HELD_KEY, 'held');
      else localStorage.removeItem(HELD_KEY);
    } catch {
      /* private mode — kept for this visit */
    }
  };

  const here = shown?.path ?? path;
  const parts = crumbs(here);
  const named = crumbs(path).join(' ').replace(/-/g, ' ');

  return (
    <div ref={root} data-theme={theme} data-terminal-window={here} data-window-films={reels.length ? (rolling ? 'rolling' : 'held') : 'stills'} className={`landing-window relative flex flex-col overflow-hidden rounded-[14px] border border-borderMuted bg-canvas text-textPrimary transition-[border-color,box-shadow] duration-500 ${className}`}>
      {/* THE BAR — which page this is, the pause, and how far through its film the window is */}
      <div className="relative shrink-0 h-10 pl-3.5 pr-2 flex items-center gap-1.5 sm:gap-3 border-b border-borderSubtle bg-panel font-mono transition-colors duration-500">
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
        {/* on a desk the film's words stand in the bar — always on screen, even while the tall window under the headline
            runs past the fold; a phone's window is a band that fits, and they sit at its foot */}
        {form === 'desk' && words && (
          <span key={`${live?.key}-${said}`} aria-hidden="true" className="ml-1.5 min-w-0 flex items-center gap-2 font-sans text-[12.5px] text-textSecondary truncate animate-fade-in" data-window-words>
            <span className="w-1 h-1 rounded-full bg-silver shrink-0" />
            <span className="truncate">{words}</span>
          </span>
        )}
        {motion && clip && (
          <button
            type="button"
            onClick={toggle}
            aria-label={held ? `Play the film of the ${named} page` : `Pause the film of the ${named} page`}
            title={held ? 'Play' : 'Pause'}
            aria-pressed={held}
            className="ml-auto shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-full text-textMuted hover:text-textPrimary hover:bg-ink/[0.07] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-silver"
            data-window-hold
          >
            {held ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        )}
        {/* how far through the film: a line under the bar, drawn by a transform */}
        {reels.length > 0 && <span ref={bar} aria-hidden="true" className="absolute left-0 right-0 -bottom-px h-px origin-left bg-silver/80 will-change-transform" style={{ transform: 'scaleX(0)' }} data-window-progress />}
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
            aria-label={`The terminal's ${crumbs(r.path).join(' ').replace(/-/g, ' ')} page, in use: ${(FILMS[r.key]?.c ?? []).map(c => c[1]).join(' ')}`}
            onLoadedMetadata={e => metadata(r, e.currentTarget)}
            onCanPlay={e => canPlay(r, e.currentTarget)}
            onError={() => setMute(true)}
            className={`absolute inset-0 w-full h-full object-cover object-left-top select-none transition-opacity duration-300 ${r.ready ? 'opacity-100' : 'opacity-0'}`}
            data-window-film={r.key}
          />
        ))}
        {/* what the film is showing, in a line at its foot (a phone's window) */}
        {form === 'phone' && words && (
          <span
            key={`${live?.key}-${said}`}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 bottom-3 sm:left-4 sm:bottom-4 max-w-[calc(100%-1.5rem)] inline-flex items-center gap-2 rounded-full border border-borderSubtle bg-panel/90 px-3 py-1.5 text-[12px] sm:text-[13px] leading-snug text-textPrimary shadow-[0_6px_24px_rgb(0_0_0/0.25)] animate-fade-in"
            data-window-words
          >
            <span className="w-1.5 h-1.5 rounded-full bg-silver shrink-0" />
            {words}
          </span>
        )}
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
