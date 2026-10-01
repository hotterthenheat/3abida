/*
==================================================
  SLAYER TERMINAL - THE TERMINAL, IN A WINDOW
  (pages/landing/TerminalWindow.tsx)

  The picture on the landing page is the terminal
  itself (Noah, 2026-09-19: "i want the REAL thing
  from our website so it doesnt scream fake") — and,
  since the same evening, a STILL of it: "keep our
  interactive visuals but then make them static. i
  dont like the idea of people flickering through the
  website without any purchases. a static image breeds
  mystery and desire."

  So the window no longer RUNS the terminal (it was a
  frame holding this same app, with "take the
  controls"). It shows PHOTOGRAPHS of it — every page
  the tour names, in both themes, at a desk's size and
  at the terminal's own phone layout — taken from the
  real app by scripts/make-landing-shots.mjs into
  public/landing/. Nothing in them is drawn for the
  landing; re-run the script when a page changes.

  WHAT STAYED: the window, its bar saying where it is
  and that the data is simulated (since 2026-10-01 the
  brand's demo band: "Simulated data. Nothing here is
  live." beside the mark), the tour's words
  choosing the picture, the window turning theme with
  the page. WHAT WENT: the live frame, "take the
  controls", "open", the lime running light (lime is
  the LIVE ink, and a still is not live).

  THE PICTURE'S SHAPE IS FIXED (1440 × 1000 on a desk),
  so the docked window takes that shape (Tour.tsx) and
  a picture is never cropped or stretched there. In one
  column the window is a fixed band and the picture
  fills it from its top left, the way a page sits in a
  window that is shorter than it.

  A change of picture is a short crossfade: the new one
  is fetched and decoded first, and only then shown, so
  the window never blinks empty between two pages.
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import type { Theme } from '../../theme/theme';
import Working from '../../components/ui/Working';
import ProductGlyph from '../../brand/ProductGlyph';

/** The desk picture's shape — what scripts/make-landing-shots.mjs photographs */
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
}

const crumbs = (pathname: string): string[] => pathname.split('/').filter(Boolean).slice(0, 3);
const slug = (path: string): string => path.replace(/^\//, '').replace(/\//g, '-');
const shotFor = (path: string, theme: Theme, form: 'desk' | 'phone'): string => `/landing/${slug(path)}-${theme}-${form}.webp`;

const TerminalWindow = ({ path, theme, desk, natural = false, className = '' }: Props) => {
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

  const want = shotFor(path, theme, narrow ? 'phone' : 'desk');
  /* THE TWO LAYERS: `shown` is on screen; when the tour asks for another, it is decoded off screen and then laid over */
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

  /* the other theme's picture of this page is fetched ahead: the window turns with the page, and the turn should not wait */
  useEffect(() => {
    const t = window.setTimeout(() => {
      new Image().src = shotFor(path, theme === 'dark' ? 'light' : 'dark', narrow ? 'phone' : 'desk');
    }, 1200);
    return () => window.clearTimeout(t);
  }, [path, theme, narrow]);

  const here = shown?.path ?? path;
  const parts = crumbs(here);

  return (
    <div data-theme={theme} data-terminal-window={here} className={`landing-window relative flex flex-col overflow-hidden rounded-[14px] border border-borderMuted bg-canvas text-textPrimary transition-[border-color,box-shadow] duration-500 ${className}`}>
      {/* THE BAR — which page this is, and that its numbers are simulated */}
      <div className="shrink-0 h-10 pl-3.5 pr-3.5 flex items-center gap-1.5 sm:gap-3 border-b border-borderSubtle bg-panel font-mono transition-colors duration-500">
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
        {/* THE DEMO BAND (Slayer Logo System, Web and App · Try before you buy): "Simulated data. Nothing here is live." */}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-textSecondary whitespace-nowrap font-sans" data-window-band>
          <span className="w-1.5 h-1.5 rounded-full bg-silver" aria-hidden="true" />
          <span className="hidden sm:inline">Simulated data. Nothing here is live.</span>
          <span className="sm:hidden">Simulated</span>
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
