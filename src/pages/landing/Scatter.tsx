/*
==================================================
  SLAYER TERMINAL - IT'S JUST SCATTERED
  (pages/landing/Scatter.tsx)

  WHY DOES IT MATTER? — shown, not said (2026-10-03, the owner: "information and hiecrcy wise i still feel as if were
  missing that wow … i love the little glitch affect i think we should implement that in more places"). "Most of what
  moves a price is public. It's just scattered." — and on screen it is: the Pulse desk's own parts (the chart, the
  strike ladder, Compass's cards, the reports ahead, the page's head and rail, cut from the hero's own still) lie about
  the screen in the footer's broken pixels, each named for what it shows. As the reader scrolls they come together into
  one window, sharpening as they land, until it is the desk itself, and the bar types "open pulse": "Slayer reads them
  together — on one screen, while the session moves." The session follows, on that same desk.

  The stage stands still while the scroll plays it (sticky); nothing moves but with the scroll, and a fast scroll tears a
  row or two, as a fast pointer does on the footer. The parts are the still's own (1440 × 1000; its panels measured off
  the staged desk, scripts/landing-stage.mjs SEED — a desk restaged moves them, and PARTS with it). Its picture is
  fetched once the reader is near. Where less motion is asked for the page shows the words alone (Landing.tsx Matters).
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import type { Theme } from '../../theme/theme';
import ProductGlyph from '../../brand/ProductGlyph';
import { useIsBelowLg } from '../../components/ui/useMediaQuery';
import { Prompt, shotFor } from './TerminalWindow';
import { inksAt, pieceOf, tear, type Piece } from './pixels';

/** THE DESK'S PARTS, where each stands in the still (1440 × 1000 — the window's picture), and what the named ones show
    (each in its own panel's words) */
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

/** where a part lies scattered: its middle (shares of the stage), its size (a share of its own), its turn (degrees), the
    way it drifts with the scroll before it travels (px over the run), and when it travels home (shares of the run) */
interface Away {
  cx: number;
  cy: number;
  k: number;
  r: number;
  dx: number;
  dy: number;
  go: [number, number];
}
const DESK: Record<string, Away> = {
  chart: { cx: 0.18, cy: 0.27, k: 0.7, r: -3, dx: -30, dy: -36, go: [0.36, 0.7] },
  ladder: { cx: 0.83, cy: 0.31, k: 0.66, r: 3.5, dx: 36, dy: -30, go: [0.4, 0.74] },
  compass: { cx: 0.2, cy: 0.79, k: 0.66, r: 2.5, dx: -36, dy: 30, go: [0.44, 0.78] },
  earnings: { cx: 0.8, cy: 0.8, k: 0.62, r: -3.5, dx: 36, dy: 36, go: [0.48, 0.82] },
  head: { cx: 0.5, cy: 0.91, k: 0.5, r: 1.5, dx: 0, dy: 24, go: [0.52, 0.84] },
  rail: { cx: 0.03, cy: 0.55, k: 0.75, r: -2.5, dx: -16, dy: 0, go: [0.54, 0.86] },
};
const PHONE: Record<string, Away> = {
  chart: { cx: 0.3, cy: 0.25, k: 1.35, r: -4, dx: -10, dy: -16, go: [0.36, 0.7] },
  ladder: { cx: 0.74, cy: 0.33, k: 1.3, r: 4, dx: 10, dy: -16, go: [0.4, 0.74] },
  compass: { cx: 0.3, cy: 0.69, k: 1.3, r: 3, dx: -10, dy: 16, go: [0.44, 0.78] },
  earnings: { cx: 0.72, cy: 0.86, k: 1.25, r: -4, dx: 10, dy: 16, go: [0.48, 0.82] },
  head: { cx: 0.5, cy: 0.94, k: 0.9, r: 2, dx: 0, dy: 10, go: [0.52, 0.84] },
  rail: { cx: 0.05, cy: 0.52, k: 1.1, r: -3, dx: -6, dy: 0, go: [0.54, 0.86] },
};
/** how sharp a part is while it lies apart: the footer's grain — fine pixels, the stronger marks — so a chart still reads
    as a chart and a ladder as a ladder */
const APART = 0.45;

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const Scatter = ({ theme }: { theme: Theme }) => {
  const small = useIsBelowLg();
  const wrap = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const caption = useRef<HTMLParagraphElement | null>(null);
  const line1 = useRef<HTMLSpanElement | null>(null);
  const line2 = useRef<HTMLSpanElement | null>(null);
  const labels = useRef(new Map<string, HTMLParagraphElement>());
  const [assembled, setAssembled] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    const st = stage.current;
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!el || !st || !c || !ctx) return;
    const AWAY = small ? PHONE : DESK;
    let alive = true;
    let raf = 0;
    let near = false;
    let listening = false;
    let img: HTMLImageElement | null = null;
    let pieces = new Map<string, Piece>();
    let vw = 0;
    let vh = 0;
    let dpr = 1;
    let screen = { x: 0, y: 0, w: 0, h: 0 };
    let homes = new Map<string, { x: number; y: number; w: number; h: number }>();
    let lastY = window.scrollY;
    let lastT = performance.now();
    let speed = 0;
    let done = false;

    /* THE WINDOW the parts come together in: the column's width, or as wide as lets it stand whole under the caption */
    const layout = () => {
      vw = st.clientWidth;
      vh = st.clientHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(vw * dpr));
      c.height = Math.max(1, Math.round(vh * dpr));
      const gutter = vw >= 1024 ? 40 : vw >= 640 ? 24 : 16;
      const col = Math.min(1160, Math.max(820, (vh - 140) * 1.44 + 2), vw - 2 * gutter);
      const top = small ? 0 : 120;
      const fit = (vh - (small ? 120 : top) - 32 - 42) * 1.44 + 2;
      const winW = Math.max(200, Math.min(col, fit));
      const scrW = winW - 2;
      const scrH = scrW / 1.44;
      const winH = scrH + 42;
      const winX = (vw - winW) / 2;
      const winY = small ? Math.max(96, (vh - winH) / 2 + 24) : top;
      screen = { x: winX + 1, y: winY + 41, w: scrW, h: scrH };
      homes = new Map(PARTS.map(p => [p.id, { x: screen.x + (p.box[0] / 1440) * scrW, y: screen.y + (p.box[1] / 1000) * scrH, w: (p.box[2] / 1440) * scrW, h: (p.box[3] / 1000) * scrH }]));
      const f = frame.current;
      if (f) Object.assign(f.style, { left: `${winX}px`, top: `${winY}px`, width: `${winW}px`, height: `${winH}px` });
      const cap = caption.current;
      if (cap) Object.assign(cap.style, { left: `${winX}px`, top: `${Math.max(72, winY - (small ? 64 : 48))}px`, maxWidth: `${winW}px` });
    };

    /* the parts, cut from the still at the size they stand at home (rebuilt when the stage changes size) */
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
      const now = performance.now();
      const y = window.scrollY;
      speed = Math.abs(y - lastY) / Math.max(1, now - lastT);
      lastY = y;
      lastT = now;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      /* the whole desk under its parts once they are home: the seams between the panels filled */
      const whole = clamp((p - 0.84) / 0.06);
      if (whole > 0 && img) {
        ctx.globalAlpha = whole;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, screen.x * dpr, screen.y * dpr, screen.w * dpr, screen.h * dpr);
        ctx.globalAlpha = 1;
      }
      const labelIn = clamp((p + 0.02) / 0.1);
      for (const part of PARTS) {
        const a = AWAY[part.id];
        const home = homes.get(part.id);
        const piece = pieces.get(part.id);
        if (!a || !home) continue;
        const u = ease(clamp((p - a.go[0]) / (a.go[1] - a.go[0])));
        const drift = Math.min(p, a.go[0]) / a.go[0];
        const fromX = a.cx * vw + a.dx * drift;
        const fromY = a.cy * vh + a.dy * drift;
        const x = lerp(fromX, home.x + home.w / 2, u);
        const yy = lerp(fromY, home.y + home.h / 2, u);
        const k = lerp(a.k, 1, u);
        const w = home.w * k;
        const h = home.h * k;
        if (piece) {
          ctx.save();
          ctx.translate(x * dpr, yy * dpr);
          ctx.rotate(((1 - u) * a.r * Math.PI) / 180);
          /* apart, broken into the footer's grain; sharpening as it lands, the picture itself home */
          const sharp = u >= 1 ? 1 : APART + (0.99 - APART) * Math.pow(u, 1.3);
          piece.draw(ctx, (-w / 2) * dpr, (-h / 2) * dpr, w * dpr, h * dpr, sharp, { alpha: lerp(theme === 'dark' ? 0.62 : 0.72, 1, u) });
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
      /* THE TEAR: a fast scroll pushes a row or two aside while the parts are on the move */
      if (p > 0.02 && p < 0.86 && speed > 1.2) tear(ctx, c, now, clamp((speed - 1.2) / 4, 0, 0.7), 6 * dpr, 23);
      /* the words: the first line whole from the start, the second coming in broken; both go as the parts gather */
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
        /* its words scattered, a hair of red and blue aside and a step out of line, until the parts gather */
        const jit = (1 - out) * (p < 0.3 ? Math.round(Math.sin(p * 90) * 2) : 0);
        l2.style.transform = `translate(${jit}px, ${-out * 24}px)`;
        const f = (1 - clamp((p - 0.18) / 0.14)) * 3;
        l2.style.textShadow = f > 0.05 ? `${-f}px 0 rgb(var(--bear) / 0.5), ${f}px 0 rgb(var(--compare) / 0.5)` : 'none';
      }
      const fr = frame.current;
      if (fr) fr.style.opacity = String(clamp((p - 0.8) / 0.08));
      const cap = caption.current;
      if (cap) {
        const capIn = clamp((p - 0.84) / 0.08);
        cap.style.opacity = String(capIn);
        cap.style.transform = `translateY(${(1 - capIn) * 10}px)`;
      }
      if (!done && p >= 0.86) {
        done = true;
        setAssembled(true);
      }
    };
    const ask = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    const load = () => {
      if (img) return;
      const i = new Image();
      i.src = shotFor('/pulse', theme, 'desk');
      i.decode().then(
        () => {
          if (!alive) return;
          img = i;
          build();
          ask();
        },
        () => {}
      );
    };
    layout();
    draw();

    /* the picture fetched once the reader is within a screen of the stage; the scroll heard only while it is on screen */
    const io = new IntersectionObserver(
      ([e]) => {
        near = e.isIntersecting;
        if (near) load();
        if (near && !listening) {
          listening = true;
          window.addEventListener('scroll', ask, { passive: true });
          ask();
        } else if (!near && listening) {
          listening = false;
          window.removeEventListener('scroll', ask);
        }
      },
      { rootMargin: '100% 0px' }
    );
    io.observe(el);
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
    return () => {
      alive = false;
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('scroll', ask);
      cancelAnimationFrame(raf);
      window.clearTimeout(resized);
    };
  }, [theme, small]);

  return (
    <div ref={wrap} className="relative" style={{ height: small ? '240svh' : '270svh' }} data-scatter>
      <div ref={stage} className="sticky top-0 h-[100svh] overflow-hidden">
        <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 w-full h-full" />
        {/* the window the parts come together in */}
        <div ref={frame} aria-hidden="true" className="absolute rounded-[10px] border border-borderMuted pointer-events-none" style={{ opacity: 0 }}>
          <div className="h-10 pl-3.5 pr-4 flex items-center gap-2.5 border-b border-borderSubtle bg-panel rounded-t-[10px]">
            <ProductGlyph name="terminal" size={16} bare className="shrink-0" />
            {assembled && <Prompt path="/pulse" />}
          </div>
        </div>
        {/* what each part shows, over it while it lies apart */}
        {PARTS.filter(p => p.label).map(p => (
          <p
            key={p.id}
            ref={n => {
              if (n) labels.current.set(p.id, n);
              else labels.current.delete(p.id);
            }}
            aria-hidden="true"
            className="absolute left-0 top-0 flex items-baseline gap-2 max-w-[17rem] lg:max-w-[22rem] text-[12px] lg:text-[13px] leading-snug text-textSecondary pointer-events-none will-change-transform"
            style={{ opacity: 0 }}
          >
            <span className="font-mono text-[10.5px] tracking-[0.18em] text-textMuted tnum">{String(ORDER.indexOf(p.id) + 1).padStart(2, '0')}</span>
            <span>{p.label}</span>
          </p>
        ))}
        {/* the words */}
        <div className="absolute inset-0 flex items-center justify-center px-6 pointer-events-none">
          <h2 className="max-w-[760px] text-center font-light tracking-[-0.045em] leading-[1.0] text-[34px] sm:text-[48px] lg:text-[64px] [text-wrap:balance]">
            <span ref={line1} className="inline-block will-change-transform">
              Most of what moves a price is public.
            </span>
            <span ref={line2} className="block text-textMuted will-change-transform" style={{ opacity: 0 }}>
              It’s just scattered.
            </span>
          </h2>
        </div>
        <p ref={caption} className="absolute text-[16px] sm:text-[18px] leading-snug text-textSecondary [text-wrap:balance]" style={{ opacity: 0 }}>
          <span className="text-textPrimary">Slayer reads them together</span> — on one screen, while the session moves.
        </p>
      </div>
    </div>
  );
};

export default Scatter;
