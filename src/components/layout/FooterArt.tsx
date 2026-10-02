/*
==================================================
  SLAYER TERMINAL - THE LIVE FOOTER
  (components/layout/FooterArt.tsx)

  THE LINE AND ITS ECHOES (2026-10-02 — the owner, of
  the first band, a tape breaking up into coloured
  dashes, specks and slips: "fix the live footer it
  doesn't look clean and together right now go online
  and look for some examples and retry it"). What the
  clean live footers share (Midday, Vercel, Dub,
  OpenStatus; TradingView's last-price pulse, Bostock's
  sliding line; Unknown Pleasures): ONE idea, in the
  product's own grammar, most of the band left as ground,
  one small true live signal, colour only where it means
  something, and a still frame that is already the design.

  So the band draws one thing, the chart's own stroke: a
  line gliding left at one steady pace, and behind it its
  own past — the same line as it stood a few seconds ago,
  and a few seconds before that — each echo a step up and
  a tier fainter, and hidden where a nearer one passes in
  front (the owner's photograph, a chart caught doubled
  and broken, put in order). The line ends at a dot that
  breathes in the silver of "live"; a dashed level runs
  from it to one tag at the edge, and the tag is the
  clock. Its old end fades into the ground.

  THE READER'S HAND: over the band a hairline follows the
  pointer, a dot rides the line under it, and the level and
  the tag go with it — the tag tells the moment that part
  of the line was drawn. Off the band it eases home to the
  live end, which breathes again.

  It is art: the line is a walk of its own and no figure
  on it is a price. Every ink is a token read off the
  band's own ground, read again when the theme turns.
  THE COST: one canvas, drawn about thirty times a second
  (sixty under the pointer) only while it is on screen with
  the tab in front; under reduced motion one still frame,
  whose clock moves on once a minute.
==================================================
*/

import { useEffect, useRef } from 'react';
import { FONT_SANS } from '../../theme/fonts';

/** a seeded walk, so the band opens on the same picture every time */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

/** the line takes a step this often (ms)… */
const STEP = 520;
/** …and its steps stand this far apart (CSS px): a steady thirteen pixels a second */
const GAP = 7;
/** the live end's breath: a ring that opens and fades for 55% of this, then rest */
const BREATH = 2600;
/** the share of the band the line's old end takes to fade into the ground */
const FADE = 0.18;
/** under the pointer, the time the hairline takes to close most of the gap to it */
const FOLLOW = 70;

/** a token's channels ("237 237 237"), read where the band stands */
const chan = (el: Element, name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;
const rgb = (c: string, a?: number) => (a == null ? `rgb(${c})` : `rgb(${c} / ${a})`);

/** the ground the band stands on — the first painted box above it — for the fill that hides a far line behind a near one */
const groundOf = (el: Element): string => {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    const m = bg.match(/rgba?\(([^)]+)\)/);
    if (!m) continue;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length === 3 || (parts[3] ?? 1) >= 0.99) return bg;
  }
  return rgb(chan(el, '--canvas', '5 5 5'));
};

interface Ink {
  line: string;
  muted: string;
  ink: string;
  live: string;
  panel: string;
  ground: string;
}
const inksOf = (el: Element): Ink => ({
  line: chan(el, '--text-primary', '237 237 237'),
  muted: chan(el, '--text-muted', '128 128 128'),
  ink: chan(el, '--ink', '255 255 255'),
  live: chan(el, '--select', '199 211 232'),
  panel: chan(el, '--panel', '17 17 17'),
  ground: groundOf(el),
});

const two = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number, seconds: boolean) => {
  const d = new Date(ms);
  return `${two(d.getHours())}:${two(d.getMinutes())}${seconds ? `:${two(d.getSeconds())}` : ''}`;
};
/** smoothstep: a step's value eases in and out, so the live end never jerks */
const ease = (t: number) => t * t * (3 - 2 * t);

const FooterArt = ({ className = 'h-[160px] md:h-[220px]' }: { className?: string }) => {
  const box = useRef<HTMLDivElement | null>(null);
  const cvs = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = box.current;
    const canvas = cvs.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* THE WALK: a line with momentum that leans back toward where it began — smooth swings, never a scribble */
    const rand = rng(20261002);
    let p = 0;
    let v = 0;
    const next = () => {
      v = v * 0.84 + (rand() - 0.5) * 0.85 - p * 0.0035;
      p += v;
      return p;
    };

    /* the band's size, and how many echoes stand behind the line and how far back (fewer and nearer on a phone) */
    let W = 0;
    let H = 0;
    let echoes = 6;
    let lag = 7;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    /* the committed steps, the time of the first, and the step the live end is walking toward */
    const vals: number[] = [];
    let t0 = performance.now();
    let pending = 0;
    const cap = () => Math.ceil(W / GAP) + lag * echoes + 8;
    /* a band grown wider is given the steps before its first, walked backward the same way */
    let bv = 0;
    const fill = () => {
      while (vals.length < cap()) {
        bv = bv * 0.84 + (rand() - 0.5) * 0.85;
        vals.unshift((vals[0] ?? 0) + bv);
        t0 -= STEP;
      }
    };
    const size = () => {
      W = host.clientWidth;
      H = host.clientHeight;
      echoes = W < 640 ? 4 : 6;
      lag = W < 640 ? 4 : 7;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    };
    size();
    /* the band opens full: the line already runs the whole width, its last step just taken */
    for (let i = 0; i < cap(); i++) vals.push(next());
    pending = next();
    t0 = performance.now() - (vals.length - 1) * STEP;
    fill();

    let ink = inksOf(host);
    ctx.font = `500 10.5px ${FONT_SANS}`;
    let tagW = Math.ceil(ctx.measureText('00:00:00').width) + 14;

    /* the scale eases after the walk, so the line never jumps when a new high or low comes in */
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);

    /* the reader's hand */
    const hand = { x: 0, on: false };
    let sx = -1;
    let last = 0;

    const draw = (now: number) => {
      const dt = last ? Math.min(100, now - last) : 16;
      last = now;
      /* the steps that came due */
      while (now - (t0 + (vals.length - 1) * STEP) >= STEP) {
        vals.push(pending);
        pending = next();
      }
      while (vals.length > cap()) {
        vals.shift();
        t0 += STEP;
      }

      const headX = W - tagW - 16;
      const n = vals.length;
      /* the value of the line at time t: a committed step, eased into the next */
      const at = (t: number) => {
        const f = (t - t0) / STEP;
        const j = Math.max(0, Math.min(n - 1, Math.floor(f)));
        const a = vals[j];
        const b = j + 1 < n ? vals[j + 1] : pending;
        return a + (b - a) * ease(Math.max(0, Math.min(1, f - j)));
      };

      /* the scale: the band's own range, eased */
      let tlo = Infinity;
      let thi = -Infinity;
      for (const x of vals) {
        if (x < tlo) tlo = x;
        if (x > thi) thi = x;
      }
      const pad = (thi - tlo) * 0.14 + 0.5;
      const k = 1 - Math.exp(-dt / 900);
      lo += (tlo - pad - lo) * k;
      hi += (thi + pad - hi) * k;
      const span = Math.max(1e-6, hi - lo);
      /* the line's own height, and each echo's step up */
      const amp = H * 0.4;
      const base = H * 0.48;
      const rise = H * 0.06;
      const yOf = (val: number, e: number) => base - e * rise + (1 - (val - lo) / span) * amp;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      /* THE LINES, the farthest first: each is the line as it stood `e * lag` steps ago, drawn so its live end meets the
         same edge — so it stands a little to the right of the one in front — and lifted a step; the ground under each
         hides the ones behind it */
      let front: { x: number; y: number }[] = [];
      for (let e = echoes; e >= 0; e--) {
        const nowE = now - e * lag * STEP;
        const pts: { x: number; y: number }[] = [];
        const first = Math.max(0, Math.floor((nowE - t0) / STEP - headX / GAP) - 1);
        for (let i = first; i < n; i++) {
          const t = t0 + i * STEP;
          if (t > nowE) break;
          pts.push({ x: headX - ((nowE - t) / STEP) * GAP, y: yOf(vals[i], e) });
        }
        pts.push({ x: headX, y: yOf(at(nowE), e) });
        if (pts.length < 2) continue;
        const path = new Path2D();
        path.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          path.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        path.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        const under = new Path2D(path);
        under.lineTo(pts[pts.length - 1].x, H);
        under.lineTo(pts[0].x, H);
        under.closePath();
        ctx.fillStyle = ink.ground;
        ctx.fill(under);
        /* the old end fades into the ground: the stroke's own ink runs from nothing to full across the first stretch */
        const c = e === 0 ? ink.line : ink.muted;
        const a = e === 0 ? 1 : Math.max(0.14, 0.62 - (e - 1) * 0.1);
        const g = ctx.createLinearGradient(0, 0, W * FADE, 0);
        g.addColorStop(0, rgb(c, 0));
        g.addColorStop(1, rgb(c, a));
        ctx.strokeStyle = g;
        ctx.lineWidth = e === 0 ? 1.6 : 1.1;
        ctx.stroke(path);
        if (e === 0) front = pts;
      }

      /* THE HAND: the hairline eases to the pointer and home again */
      const target = hand.on ? Math.max(W * FADE * 0.6, Math.min(headX, hand.x)) : headX;
      if (sx < 0) sx = headX;
      sx = calm ? target : sx + (target - sx) * (1 - Math.exp(-dt / FOLLOW));
      if (Math.abs(target - sx) < 0.3) sx = target;
      const held = headX - sx > 0.75;
      /* the point under it, on the line */
      let dotY = front.length ? front[front.length - 1].y : H / 2;
      if (held && front.length > 1) {
        let j = front.findIndex(q => q.x >= sx);
        if (j <= 0) j = 1;
        const a = front[j - 1];
        const b = front[j];
        dotY = a.y + (b.y - a.y) * ((sx - a.x) / Math.max(1e-6, b.x - a.x));
      }
      if (held) {
        ctx.strokeStyle = rgb(ink.ink, 0.26);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(sx) + 0.5, 0);
        ctx.lineTo(Math.round(sx) + 0.5, H);
        ctx.stroke();
      }

      /* the level: a dashed hairline at the point's height, across the band to the tag */
      ctx.strokeStyle = rgb(ink.ink, 0.22);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      const ly = Math.round(dotY) + 0.5;
      ctx.moveTo(W * FADE, ly);
      ctx.lineTo(W - tagW, ly);
      ctx.stroke();
      ctx.setLineDash([]);

      /* the live end's breath — the silver ring opens and fades, then rests; it gives way while the hand holds the line */
      if (!calm) {
        const q = (now % BREATH) / (BREATH * 0.55);
        const away = Math.min(1, (headX - sx) / 24);
        if (q <= 1 && away < 1) {
          ctx.strokeStyle = rgb(ink.live, 0.6 * (1 - q) * (1 - away));
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(headX, front.length ? front[front.length - 1].y : H / 2, 3 + 10 * q, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      /* the dot: at the live end, or under the hand */
      ctx.fillStyle = rgb(ink.line);
      ctx.beginPath();
      ctx.arc(held ? sx : headX, held ? dotY : front.length ? front[front.length - 1].y : H / 2, held ? 3 : 2.6, 0, Math.PI * 2);
      ctx.fill();

      /* the tag: the clock — now, or the moment under the hand */
      const when = Date.now() - (held ? ((headX - sx) / GAP) * STEP : 0);
      const word = clock(when, !calm);
      ctx.font = `500 10.5px ${FONT_SANS}`;
      const tw = Math.ceil(ctx.measureText(word).width) + 14;
      const ty = Math.max(10, Math.min(H - 10, dotY));
      ctx.fillStyle = rgb(ink.line);
      ctx.beginPath();
      ctx.roundRect(W - tw, ty - 9, tw, 18, 3);
      ctx.fill();
      ctx.fillStyle = rgb(ink.panel);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word, W - tw / 2, ty + 0.5);
      tagW = Math.max(tagW, tw);
    };

    /* it draws only while it is seen, with the tab in front — about thirty times a second, sixty under the hand */
    let raf = 0;
    let seen = false;
    let drawn = 0;
    const loop = (now: number) => {
      raf = 0;
      if (!seen || document.visibilityState !== 'visible') return;
      if (now - drawn >= (hand.on || sx !== W - tagW - 16 ? 15 : 32)) {
        drawn = now;
        draw(now);
      }
      raf = requestAnimationFrame(loop);
    };
    const go = () => {
      if (calm || raf || !seen || document.visibilityState !== 'visible') return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    /* under reduced motion the frame stands still; its clock moves on once a minute while it is seen */
    let tick = 0;
    const minute = () => {
      window.clearTimeout(tick);
      if (!calm || !seen) return;
      draw(performance.now());
      tick = window.setTimeout(minute, 60_000 - (Date.now() % 60_000) + 50);
    };
    const redraw = () => {
      if (calm || !raf) draw(performance.now());
    };

    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      hand.x = e.clientX - r.left;
      hand.on = true;
      go();
      if (calm) draw(performance.now());
    };
    const leave = () => {
      hand.on = false;
      go();
      if (calm) draw(performance.now());
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') leave();
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', move);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('pointercancel', leave);
    canvas.addEventListener('pointerup', up);

    draw(performance.now());
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      if (calm) minute();
      else go();
    });
    io.observe(host);
    const ro = new ResizeObserver(() => {
      size();
      fill();
      redraw();
    });
    ro.observe(host);
    /* a theme turn: every ink read again once the new ground is on the page, and the frame drawn again even when still */
    let themed = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(themed);
      themed = requestAnimationFrame(() => {
        ink = inksOf(host);
        redraw();
      });
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'], subtree: true });
    document.addEventListener('visibilitychange', go);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(themed);
      window.clearTimeout(tick);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', go);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerdown', move);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointercancel', leave);
      canvas.removeEventListener('pointerup', up);
    };
  }, []);

  return (
    <div ref={box} className={`relative w-full ${className}`} data-footer-art>
      <canvas ref={cvs} aria-hidden="true" className="absolute inset-0 block touch-pan-y" />
    </div>
  );
};

export default FooterArt;
