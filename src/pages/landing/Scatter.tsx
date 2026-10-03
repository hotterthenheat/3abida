/*
==================================================
  SLAYER TERMINAL - IT'S JUST SCATTERED
  (pages/landing/Scatter.tsx)

  WHY DOES IT MATTER? — shown, not said (2026-10-03, the owner: "information and hiecrcy wise i still feel as if were
  missing that wow … i love the little glitch affect i think we should implement that in more places"). "Most of what
  moves a price is public. It's just scattered." — and on screen it is: the Pulse desk's own parts (the chart, the
  strike ladder, Compass's cards, the reports ahead, the page's head and rail) lie about the screen, each named for what
  it shows. As the reader scrolls they come together, sharpening as they land.

  REFINED THE SAME DAY (the owner's partner: the glitches were "too gamified"): the parts lie flat, never tilted, in a fine
  grain without their colour (pixels.ts), and nothing tears; they sharpen and take their colour as they land.

  THE DESK COMES TOGETHER ONCE (the same day — the landing showed the same desk three times: the hero's, this one
  gathered in a window of its own, and the session's under it). The parts now gather into THE SESSION'S OWN WINDOW
  (Session.tsx `story`), standing on the right, and they are cut from the session's own first picture: the window stands
  hidden while they come, comes in on the same picture as they land, its bar types "open pulse", and the session's first
  words come in beside it — "Slayer reads them together, on one screen, while the session moves." — before the beats come
  up and the window plays the session. One desk, gathered once. A desk only: a phone (the parts read as grey smudges and
  the desk gathered at a phone's width could not be read) and less motion have the words alone (Landing.tsx Matters).

  The stage stands still while the scroll plays it (sticky); nothing moves but with the scroll. The parts' boxes are the
  desk's panels measured off the picture (1440 × 1000 — scripts/landing-stage.mjs SEED; the session's run is the same
  desk): a desk restaged moves them, and PARTS with it. The picture is fetched once the reader is near.
==================================================
*/

import { useEffect, useRef } from 'react';
import type { Theme } from '../../theme/theme';
import { beatSrc, type Story } from './Session';
import { inksAt, pieceOf, type Piece } from './pixels';

/** THE DESK'S PARTS, where each stands in the picture (1440 × 1000), and what the named ones show (each in its own
    panel's words) */
const PARTS: { id: string; box: [number, number, number, number]; label?: string }[] = [
  { id: 'rail', box: [0, 0, 52, 1000] },
  { id: 'head', box: [60, 8, 1372, 168] },
  { id: 'earnings', box: [752, 685, 664, 315], label: 'The reports ahead, and the move priced for each' },
  { id: 'compass', box: [76, 685, 664, 315], label: 'The contracts that fit those levels' },
  { id: 'ladder', box: [752, 185, 664, 488], label: 'Where the options positions sit, strike by strike' },
  { id: 'chart', box: [76, 185, 664, 488], label: 'Price, and the levels under it' },
];
/** the order the named parts are numbered in, as a reader meets them */
const ORDER = ['chart', 'ladder', 'compass', 'earnings'];

/** where a part lies apart: its middle (shares of the stage), its size (a share of its own), the way it drifts with the
    scroll before it travels (px over the run), and when it travels home (shares of the run) */
interface Away {
  cx: number;
  cy: number;
  k: number;
  dx: number;
  dy: number;
  go: [number, number];
}
const AWAY: Record<string, Away> = {
  chart: { cx: 0.18, cy: 0.27, k: 0.7, dx: -30, dy: -36, go: [0.36, 0.7] },
  ladder: { cx: 0.83, cy: 0.31, k: 0.66, dx: 36, dy: -30, go: [0.4, 0.74] },
  compass: { cx: 0.2, cy: 0.79, k: 0.66, dx: -36, dy: 30, go: [0.44, 0.78] },
  earnings: { cx: 0.8, cy: 0.8, k: 0.62, dx: 36, dy: 36, go: [0.48, 0.82] },
  head: { cx: 0.5, cy: 0.91, k: 0.5, dx: 0, dy: 24, go: [0.52, 0.84] },
  rail: { cx: 0.03, cy: 0.55, k: 0.75, dx: -16, dy: 0, go: [0.54, 0.86] },
};
/** how sharp a part is while it lies apart: a fine grain, without its colour — a chart still reads as a chart and a
    ladder as a ladder */
const APART = 0.25;
/** the run's marks: the parts all home, the window in on them, the parts gone and the session's words in */
const LANDED = 0.86;

/** the overlay's height (svh): the parts' run is this less the screen the stage stands on */
export const TRACK = 200;

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Props {
  theme: Theme;
  /** the session's window, its picture and its first words (Session.tsx) */
  story: Pick<Story, 'stage' | 'screen' | 'intro'>;
  /** the parts are home (and when they leave it again, scrolled back) */
  onLanded: (landed: boolean) => void;
}

const Scatter = ({ theme, story, onLanded }: Props) => {
  const wrap = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const line1 = useRef<HTMLSpanElement | null>(null);
  const line2 = useRef<HTMLSpanElement | null>(null);
  const labels = useRef(new Map<string, HTMLParagraphElement>());
  const landedNow = useRef(onLanded);
  landedNow.current = onLanded;

  useEffect(() => {
    const el = wrap.current;
    const st = stage.current;
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!el || !st || !c || !ctx) return;
    let alive = true;
    let raf = 0;
    let listening = false;
    let img: HTMLImageElement | null = null;
    let pieces = new Map<string, Piece>();
    let vw = 0;
    let vh = 0;
    let dpr = 1;
    let screen = { x: 0, y: 0, w: 0, h: 0 };
    let homes = new Map<string, { x: number; y: number; w: number; h: number }>();
    let landed = false;
    /** the run as last drawn: a run at rest is not drawn again */
    let last = -1;

    /* WHERE THE PARTS COME HOME: the session window's picture, where it stands (sticky) while the run plays */
    const layout = () => {
      vw = st.clientWidth;
      vh = st.clientHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(vw * dpr));
      c.height = Math.max(1, Math.round(vh * dpr));
      const scr = story.screen.current;
      const stg = story.stage.current;
      if (scr && stg) {
        const o = st.getBoundingClientRect();
        const r = scr.getBoundingClientRect();
        const s = stg.getBoundingClientRect();
        const top = parseFloat(getComputedStyle(stg).top) || 96;
        screen = { x: r.left - o.left, y: top + (r.top - s.top), w: r.width, h: r.height };
      }
      homes = new Map(PARTS.map(p => [p.id, { x: screen.x + (p.box[0] / 1440) * screen.w, y: screen.y + (p.box[1] / 1000) * screen.h, w: (p.box[2] / 1440) * screen.w, h: (p.box[3] / 1000) * screen.h }]));
      last = -1;
    };

    /* the parts, cut from the picture at the size they stand at home (cut again when the stage changes size) */
    const build = () => {
      if (!img || !img.naturalWidth) return;
      const s = img.naturalWidth / 1440;
      const inks = inksAt(st);
      const next = new Map<string, Piece>();
      for (const p of PARTS) {
        const h = homes.get(p.id);
        if (!h) continue;
        const piece = pieceOf(img, p.box[0] * s, p.box[1] * s, p.box[2] * s, p.box[3] * s, h.w, h.h, inks);
        if (piece) next.set(p.id, piece);
      }
      pieces = next;
      last = -1;
    };

    /* the run: 0 as the stage pins, 1 as it lets go */
    const progress = () => {
      const r = el.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - vh));
    };

    const draw = () => {
      raf = 0;
      if (!alive) return;
      const p = progress();
      if (p === last) return;
      last = p;

      /* THE HAND-OVER: the window comes in on the same picture as the parts land, then the parts go and the session's
         first words come in beside it; the bar types once they are home */
      const stg = story.stage.current;
      if (stg) stg.style.opacity = String(clamp((p - LANDED) / 0.06));
      const gone = clamp((p - 0.93) / 0.05);
      c.style.opacity = String(1 - gone);
      const intro = story.intro.current;
      if (intro) {
        const t = clamp((p - 0.88) / 0.08);
        intro.style.opacity = String(t);
        intro.style.transform = t >= 1 ? '' : `translateY(${Math.round((1 - t) * 12)}px)`;
      }
      const home = p >= LANDED;
      if (home !== landed) {
        landed = home;
        landedNow.current(home);
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      if (gone < 1) {
        /* the whole picture under its parts once they are home: the seams between the panels filled */
        const whole = clamp((p - 0.84) / 0.06);
        if (whole > 0 && img) {
          ctx.globalAlpha = whole;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(img, screen.x * dpr, screen.y * dpr, screen.w * dpr, screen.h * dpr);
          ctx.globalAlpha = 1;
        }
      }
      const labelIn = clamp((p + 0.02) / 0.1);
      for (const part of PARTS) {
        const a = AWAY[part.id];
        const at = homes.get(part.id);
        const piece = pieces.get(part.id);
        if (!a || !at) continue;
        const u = ease(clamp((p - a.go[0]) / (a.go[1] - a.go[0])));
        const drift = Math.min(p, a.go[0]) / a.go[0];
        const fromX = a.cx * vw + a.dx * drift;
        const fromY = a.cy * vh + a.dy * drift;
        const x = lerp(fromX, at.x + at.w / 2, u);
        const yy = lerp(fromY, at.y + at.h / 2, u);
        const k = lerp(a.k, 1, u);
        const w = at.w * k;
        const h = at.h * k;
        if (piece && gone < 1) {
          ctx.save();
          ctx.translate(x * dpr, yy * dpr);
          /* apart, a fine grain without its colour; sharpening as it lands, the picture itself home */
          const sharp = u >= 1 ? 1 : APART + (0.99 - APART) * Math.pow(u, 1.3);
          piece.draw(ctx, (-w / 2) * dpr, (-h / 2) * dpr, w * dpr, h * dpr, sharp, { alpha: lerp(theme === 'dark' ? 0.5 : 0.6, 1, u) });
          ctx.restore();
        }
        const lab = labels.current.get(part.id);
        if (lab) {
          /* over its part, and kept on the screen */
          const lx = clamp(x - w / 2, 16, Math.max(16, vw - lab.offsetWidth - 16));
          lab.style.transform = `translate(${Math.round(lx)}px, ${Math.round(Math.max(72, yy - h / 2 - lab.offsetHeight - 10))}px)`;
          lab.style.opacity = String(labelIn * clamp(1 - u * 4));
        }
      }
      /* the words: the first line whole from the start, the second coming in after it; both go as the parts gather */
      const out = clamp((p - 0.3) / 0.1);
      const l1 = line1.current;
      const l2 = line2.current;
      if (l1) {
        l1.style.opacity = String(1 - out);
        l1.style.transform = `translateY(${-out * 24}px)`;
      }
      if (l2) {
        const inn = clamp((p - 0.04) / 0.08);
        l2.style.opacity = String(inn * (1 - out));
        l2.style.transform = `translateY(${(1 - inn) * 8 - out * 24}px)`;
      }
    };
    const ask = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    /* the picture waits for the page's own first things (the hero's picture, its film) and for the story to be near */
    let near = false;
    const load = () => {
      if (img || !near || document.readyState !== 'complete') return;
      const i = new Image();
      i.src = beatSrc(theme, 0);
      img = i;
      i.decode().then(
        () => {
          if (!alive) return;
          build();
          ask();
        },
        () => {}
      );
    };
    layout();
    draw();

    /* the picture fetched once the reader is within a screen of the story; the scroll heard only while it is on screen,
       and read once more as it leaves, so a story scrolled past stands finished (and one not yet reached, not begun) */
    const scope = el.closest('[data-story]') ?? el;
    const io = new IntersectionObserver(
      ([e]) => {
        near = e.isIntersecting;
        if (e.isIntersecting) {
          load();
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
    io.observe(scope);
    window.addEventListener('load', load);
    let resized = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resized);
      resized = window.setTimeout(() => {
        if (!alive) return;
        layout();
        build();
        ask();
      }, 120);
    });
    ro.observe(st);
    if (story.screen.current) ro.observe(story.screen.current);
    return () => {
      alive = false;
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('load', load);
      window.removeEventListener('scroll', ask);
      cancelAnimationFrame(raf);
      window.clearTimeout(resized);
    };
  }, [theme, story.stage, story.screen, story.intro]);

  return (
    <div ref={wrap} className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: `${TRACK}svh` }} data-scatter>
      <div ref={stage} className="sticky top-0 h-[100svh] overflow-hidden">
        <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 w-full h-full" />
        {/* what each part shows, over it while it lies apart */}
        {PARTS.filter(p => p.label).map(p => (
          <p
            key={p.id}
            ref={n => {
              if (n) labels.current.set(p.id, n);
              else labels.current.delete(p.id);
            }}
            aria-hidden="true"
            className="absolute left-0 top-0 flex items-baseline gap-2 max-w-[22rem] text-[13px] leading-snug text-textSecondary will-change-transform"
            style={{ opacity: 0 }}
          >
            <span className="font-mono text-[10.5px] tracking-[0.18em] text-textMuted tnum">{String(ORDER.indexOf(p.id) + 1).padStart(2, '0')}</span>
            <span>{p.label}</span>
          </p>
        ))}
        {/* the words */}
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <h2 className="max-w-[760px] text-center font-light tracking-[-0.045em] leading-[1.0] text-[64px] [text-wrap:balance] outline-none">
            <span ref={line1} className="inline-block will-change-transform">
              Most of what moves a price is public.
            </span>
            <span ref={line2} className="block text-textMuted will-change-transform" style={{ opacity: 0 }}>
              It’s just scattered.
            </span>
          </h2>
        </div>
      </div>
    </div>
  );
};

export default Scatter;
