/*
==================================================
  SLAYER TERMINAL - THE WALL OF DESKS
  (pages/landing/Wall.tsx)

  EVERY DESK ON THE FIRST SCREEN (2026-10-01 — the
  owner, of the rooms that waited behind buttons: "the
  first thing you see should be all the desks not you
  having to click on each one"). The eight rooms of the
  terminal side by side, the way a trader's desk is a
  wall of screens, each one playing a sped-up stretch
  of someone working it with nothing over it but their
  cursor (scripts/make-landing-clips.mjs films them and
  writes these small copies: public/landing/wall/).

  Four across and two down on a desk, two across on a
  phone — and on a phone the wall comes before the
  words, so all eight are on the first screen. Every
  screen is a door to its room in the tour below.

  THE COST. Eight small films (640 wide) play at once,
  only while the wall is on screen and the tab is in
  front; each starts its own share further into its film
  (the fourth a third of the way in, …), so the wall
  never ticks in step. Where motion is not
  wanted — less motion asked for, data being saved — and
  where a film cannot play, the screen is its still.
  The glyph sits bare on the screen's bar: no box round
  any logo (the owner, the same day).
==================================================
*/

import { useEffect, useRef, useState } from 'react';
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
}

const stillFor = (path: string, theme: Theme) => `/landing/wall/${slug(path)}-${theme}.webp`;
const filmFor = (path: string, theme: Theme) => `/landing/wall/clips/${slug(path)}-${theme}.mp4`;

const Wall = ({ rooms, theme, onPick }: { rooms: WallRoom[]; theme: Theme; onPick: (id: string) => void }) => {
  const calm = useReducedMotion();
  const [frugal] = useState(savingData);
  /* a screen whose film will not play shows its still from then on */
  const [stills, setStills] = useState<Set<string>>(() => new Set());
  const motion = !calm && !frugal;

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
  }, [rolling, theme]);
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

  return (
    /* ON A SHORT DESK (a laptop's 760 px) two rows of screens ran under the fold: from lg the wall is only as wide as the
       height left under the words lets both rows stand on the first screen (434 px of words and margins; a screen is
       1.44 as wide as it is tall, plus its bar) — and never narrower than 720 */
    <div ref={wall} data-theme={theme} className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3 lg:max-w-[max(720px,calc((100svh_-_434px)*2.88_+_36px))]" data-landing-wall>
      {rooms.map((r, i) => {
        const film = motion && !stills.has(`${r.id}-${theme}`);
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onPick(r.id)}
            aria-label={`${r.name} — see it in the tour`}
            className="landing-rise landing-screen group relative flex flex-col overflow-hidden rounded-[10px] sm:rounded-[12px] border border-borderMuted bg-canvas text-left text-textPrimary transition-[transform,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-textPrimary/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver"
            style={{ ['--rise-delay' as string]: `${240 + i * 45}ms` }}
            data-wall-room={r.id}
          >
            {/* THE SCREEN'S BAR: the room's glyph, bare, and its name */}
            <span className="shrink-0 h-[22px] sm:h-7 px-2 sm:px-2.5 flex items-center gap-1.5 sm:gap-2 border-b border-borderSubtle bg-panel">
              {r.glyph && <ProductGlyph name={r.glyph} size={12} bare className="shrink-0 sm:w-[14px] sm:h-[14px]" />}
              <span className="min-w-0 truncate text-[11px] sm:text-[12.5px] font-medium">{r.name}</span>
            </span>
            {/* THE SCREEN */}
            <span className="relative block w-full aspect-[1440/1000] overflow-hidden bg-canvas">
              <img src={stillFor(r.path, theme)} alt="" aria-hidden="true" draggable={false} decoding="async" className="absolute inset-0 w-full h-full object-cover object-left-top select-none" />
              {film && (
                <video
                  key={`${r.id}-${theme}`}
                  ref={el => {
                    if (el) videos.current.set(r.id, el);
                    else videos.current.delete(r.id);
                  }}
                  src={filmFor(r.path, theme)}
                  poster={stillFor(r.path, theme)}
                  muted
                  loop
                  playsInline
                  preload="auto"
                  disablePictureInPicture
                  aria-hidden="true"
                  onLoadedData={e => canPlay(`${r.id}-${theme}`, i, e.currentTarget)}
                  onCanPlay={e => canPlay(`${r.id}-${theme}`, i, e.currentTarget)}
                  onPlaying={e => canPlay(`${r.id}-${theme}`, i, e.currentTarget)}
                  onSeeked={e => canPlay(`${r.id}-${theme}`, i, e.currentTarget)}
                  onError={() => setStills(s => new Set(s).add(`${r.id}-${theme}`))}
                  className={`absolute inset-0 w-full h-full object-cover object-left-top select-none transition-opacity duration-500 ${ready.has(`${r.id}-${theme}`) ? 'opacity-100' : 'opacity-0'}`}
                  data-wall-film={r.id}
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default Wall;
