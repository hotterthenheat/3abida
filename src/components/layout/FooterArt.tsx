/*
==================================================
  SLAYER TERMINAL - THE LIVE FOOTER
  (components/layout/FooterArt.tsx)

  THE TAPE, DISSOLVING (2026-10-02 — the owner, with a
  photograph of a chart caught dark and broken on a
  phone: "the footer we have i need you to make it super
  cool like a live footer make some sort of artistic
  thing from the photo"). The photograph is the terminal
  seen through a failing lens: a white price line and its
  bright tick of volume, a level running off to a tag, and
  around them the desk breaking up into coloured dashes —
  a ladder's rows, a strip of buttons, one of them lit,
  and a pointer. This band draws that, live: the line walks
  on, the volume ticks under it, the ladder's rows flicker
  out and back, a slice of the picture slips sideways now
  and then, and the pointer is the reader's own when they
  are over it (a hairline through the line, its time at
  the foot) and drifts by itself when they are not.

  It is art, and says nothing a reader could trade on: the
  line is a walk of its own, the tag is the clock. Every
  ink is a token read off the band's own ground (the
  footer can stand on either), so it is a dark print on a
  dark page and a light one on paper.

  THE COST: one canvas, drawn about thirty times a second
  only while it is on screen with the tab in front; under
  reduced motion it draws one frame and stops.
==================================================
*/

import { useEffect, useRef } from 'react';
import { readToken } from '../../theme/theme';
import { FONT_SANS } from '../../theme/fonts';

/** a seeded walk, so the band opens on the same picture every time */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

interface Ink {
  line: string;
  bar: string;
  faint: string;
  ghost: string;
  call: string;
  put: string;
  down: string;
  supreme: string;
  warn: string;
  ground: string;
}
const inksOf = (el: Element): Ink => ({
  line: readToken('--text-primary', undefined, el),
  bar: readToken('--text-primary', 0.82, el),
  faint: readToken('--text-muted', 0.55, el),
  ghost: readToken('--ink', 0.07, el),
  call: readToken('--glacier', undefined, el),
  put: readToken('--ember', undefined, el),
  down: readToken('--bear', undefined, el),
  supreme: readToken('--supreme', undefined, el),
  warn: readToken('--warn', undefined, el),
  ground: readToken('--canvas', undefined, el),
});

const POINTS = 220;
const STEP_MS = 110;

const FooterArt = ({ className = 'h-[180px] md:h-[240px]' }: { className?: string }) => {
  const box = useRef<HTMLDivElement | null>(null);
  const cvs = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = box.current;
    const canvas = cvs.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rand = rng(20261002);

    /* THE WALK: a price that wanders and leans back to where it began, and the volume of each step */
    const price: number[] = [];
    const grain: number[][][] = [];
    const vol: number[] = [];
    let p = 0;
    let v = 0;
    const walk = () => {
      v = v * 0.55 + (rand() - 0.5) * 1.5 - p * 0.012;
      p += v;
      price.push(p);
      vol.push(Math.min(1, 0.18 + Math.abs(v) * 0.6 + rand() * 0.45));
      /* each point's scatter once it reaches the dissolving end: where its pixels land */
      grain.push(Array.from({ length: 4 }, () => [(rand() - 0.5) * 7, (rand() - 0.5) * 9, rand()]));
      if (price.length > POINTS) {
        price.shift();
        vol.shift();
        grain.shift();
      }
    };
    for (let i = 0; i < POINTS; i++) walk();

    /* THE LADDER, BREAKING UP: rows of put and call dashes either side of an axis, each row's strength wandering, each
       dash there or not */
    const ROWS = 22;
    const DASHES = 24;
    const ladder = Array.from({ length: ROWS }, (_, i) => ({ put: rand(), call: rand(), lit: rand(), sup: i === 7, gone: Array.from({ length: DASHES * 2 }, () => rand() < 0.18) }));
    /* THE TICKS over the chart: four rows of dashes, each there or not, changing a few at a step (not every frame — the
       band is a tape breaking up, not snow) */
    const ticks = Array.from({ length: 4 }, () => Array.from({ length: 64 }, () => ({ on: rand() > 0.35, w: 6 + rand() * 10, a: 0.18 + rand() * 0.25 })));
    /* SPECKS: the desk's chrome, gone to coloured dashes */
    const specks = Array.from({ length: 90 }, () => ({ x: rand(), y: rand(), w: 2 + rand() * 12, k: Math.floor(rand() * 5), life: rand() }));
    /* THE STRIP OF BUTTONS at the foot, one lit */
    const pills = Array.from({ length: 6 }, (_, i) => ({ w: 46 + rand() * 60, lit: i === 3 }));

    let ink = inksOf(host);
    let W = 0;
    let H = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => {
      W = host.clientWidth;
      H = host.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    };
    size();

    /* the pointer: the reader's while they are over the band, else a drift of its own */
    const hand = { x: -1, y: -1, on: false, sx: 0, sy: 0 };
    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      hand.x = e.clientX - r.left;
      hand.y = e.clientY - r.top;
      hand.on = true;
    };
    const leave = () => {
      hand.on = false;
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerleave', leave);

    let t0 = performance.now();
    let acc = 0;
    let glitch = 0;
    let glitchY = 0;
    let glitchH = 0;
    let glitchDx = 0;
    let frame = 0;

    const draw = (now: number) => {
      const dt = Math.min(200, now - t0);
      t0 = now;
      acc += dt;
      while (acc > STEP_MS) {
        acc -= STEP_MS;
        walk();
        for (const r of ladder) {
          r.put = Math.max(0, Math.min(1, r.put + (rand() - 0.5) * 0.12));
          r.call = Math.max(0, Math.min(1, r.call + (rand() - 0.5) * 0.12));
          r.lit = Math.max(0, Math.min(1, r.lit + (rand() - 0.5) * 0.3));
          for (let k = 0; k < 3; k++) {
            const j = Math.floor(rand() * r.gone.length);
            r.gone[j] = !r.gone[j] && rand() < 0.35;
          }
        }
        for (const row of ticks)
          for (let k = 0; k < 4; k++) {
            const t = row[Math.floor(rand() * row.length)];
            t.on = rand() > 0.35;
          }
        for (const s of specks) {
          s.life -= 0.04 + rand() * 0.05;
          if (s.life < 0) {
            s.x = rand();
            s.y = rand();
            s.w = 2 + rand() * 12;
            s.k = Math.floor(rand() * 5);
            s.life = 0.4 + rand() * 0.6;
          }
        }
        if (!glitch && rand() < 0.035) {
          glitch = 2 + Math.floor(rand() * 3);
          glitchY = rand() * 0.8;
          glitchH = 0.04 + rand() * 0.14;
          glitchDx = (rand() - 0.5) * 60;
        }
      }
      if (frame++ % 30 === 0) ink = inksOf(host);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      /* the chart's box: the left half and a little more */
      const cx0 = W * 0.04;
      const cx1 = W * (W < 640 ? 0.74 : 0.56);
      const ly0 = H * 0.2;
      const ly1 = H * 0.58;
      const vy0 = H * 0.64;
      const vy1 = H * 0.82;
      const lo = Math.min(...price);
      const hi = Math.max(...price);
      const xAt = (i: number) => cx0 + ((cx1 - cx0) * i) / (POINTS - 1);
      const yAt = (q: number) => ly1 - ((q - lo) / (hi - lo || 1)) * (ly1 - ly0);

      /* the faint rows of ticks over the line (the photograph's coloured dashes above the chart) */
      ticks.forEach((row, r) => {
        const y = H * 0.07 + r * 7;
        const gap = 24 + ((r * 13) % 11);
        ctx.fillStyle = r % 2 ? ink.call : ink.put;
        row.forEach((t, k) => {
          const x = cx0 + k * gap;
          if (!t.on || x > cx1) return;
          ctx.globalAlpha = t.a;
          ctx.fillRect(x, y, t.w, 1.2);
        });
      });
      ctx.globalAlpha = 1;

      /* the volume: a bright comb under the line */
      const bw = Math.max(1, ((cx1 - cx0) / POINTS) * 0.62);
      ctx.fillStyle = ink.bar;
      for (let i = 0; i < POINTS; i++) {
        const h = vol[i] * (vy1 - vy0);
        ctx.fillRect(xAt(i), vy1 - h, bw, h);
      }
      /* its time marks */
      ctx.fillStyle = ink.faint;
      for (let k = 1; k < 6; k++) ctx.fillRect(cx0 + ((cx1 - cx0) * k) / 6, vy1 + 6, 12, 2);

      /* the line, with a breath of glow */
      ctx.save();
      ctx.shadowColor = ink.line;
      ctx.shadowBlur = 6;
      ctx.strokeStyle = ink.line;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      /* THE OLD END DISSOLVES: the first fifth of the line breaks into the pixels it was drawn with, scattering the
         further back they are; the rest is the line */
      const FRAY = Math.round(POINTS * 0.22);
      ctx.beginPath();
      for (let i = FRAY; i < POINTS; i++) {
        const x = xAt(i);
        const y = yAt(price[i]);
        if (i > FRAY) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = ink.line;
      for (let i = 0; i < FRAY; i++) {
        const back = 1 - i / FRAY;
        const x = xAt(i);
        const y = yAt(price[i]);
        for (const [gx, gy, keep] of grain[i]) {
          if (keep < back * 0.75) continue;
          ctx.globalAlpha = 0.35 + (1 - back) * 0.65;
          ctx.fillRect(x + gx * back, y + gy * back, 1.6, 1.6);
        }
      }
      ctx.globalAlpha = 1;

      /* the level off the last price, to its tag — the tag tells the clock */
      const lastY = yAt(price[POINTS - 1]);
      const tagX = Math.min(W - 70, cx1 + W * 0.05);
      ctx.strokeStyle = ink.line;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx1, lastY + 0.5);
      ctx.lineTo(tagX, lastY + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const d = new Date();
      const clock = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
      ctx.font = `600 10px ${FONT_SANS}`;
      const tw = ctx.measureText(clock).width + 10;
      ctx.strokeRect(tagX + 0.5, lastY - 7.5, tw, 15);
      ctx.fillStyle = ink.line;
      ctx.textBaseline = 'middle';
      ctx.fillText(clock, tagX + 5, lastY + 0.5);

      /* the ladder on the right, coming apart */
      if (W >= 640) {
        const ax = W * 0.79;
        const r0 = H * 0.12;
        const pitch = (H * 0.72) / ROWS;
        const reach = W * 0.12;
        ladder.forEach((r, i) => {
          const y = r0 + i * pitch;
          const on = r.lit > 0.25;
          if (!on) return;
          ctx.globalAlpha = 0.35 + r.lit * 0.6;
          ctx.fillStyle = r.sup ? ink.supreme : ink.put;
          for (let k = 0; k * 7 < r.put * reach && k < DASHES; k++) if (!r.gone[k]) ctx.fillRect(ax - 9 - k * 7, y, 5, 2);
          ctx.fillStyle = r.sup ? ink.supreme : ink.call;
          for (let k = 0; k * 7 < r.call * reach && k < DASHES; k++) if (!r.gone[DASHES + k]) ctx.fillRect(ax + 4 + k * 7, y, 5, 2);
          ctx.fillStyle = ink.faint;
          ctx.fillRect(ax - reach - 26, y, 12, 2);
        });
        ctx.globalAlpha = 1;
      }

      /* the specks */
      const hue = [ink.call, ink.put, ink.down, ink.faint, ink.line];
      for (const s of specks) {
        ctx.globalAlpha = Math.max(0, Math.min(1, s.life)) * 0.75;
        ctx.fillStyle = hue[s.k];
        ctx.fillRect(s.x * W, s.y * H, s.w, 1.5);
      }
      ctx.globalAlpha = 1;

      /* the strip of buttons at the foot, one lit in the warning ink */
      let px = cx0;
      const py = H * 0.9;
      ctx.lineWidth = 1;
      for (const b of pills) {
        if (px + b.w > cx1) break;
        ctx.strokeStyle = b.lit ? ink.warn : ink.faint;
        ctx.globalAlpha = b.lit ? 0.95 : 0.6;
        ctx.beginPath();
        ctx.roundRect(px + 0.5, py - 6.5, b.w, 13, 6.5);
        ctx.stroke();
        ctx.fillStyle = b.lit ? ink.warn : ink.faint;
        ctx.fillRect(px + 7, py - 1, b.w * 0.55, 2);
        px += b.w + 12;
      }
      ctx.globalAlpha = 1;

      /* the pointer, and while it is the reader's, a hairline through the line and its time */
      if (hand.on) {
        hand.sx += (hand.x - hand.sx) * 0.35;
        hand.sy += (hand.y - hand.sy) * 0.35;
        if (hand.sx > cx0 && hand.sx < cx1) {
          const i = Math.max(0, Math.min(POINTS - 1, Math.round(((hand.sx - cx0) / (cx1 - cx0)) * (POINTS - 1))));
          ctx.strokeStyle = ink.faint;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(Math.round(hand.sx) + 0.5, ly0 - 10);
          ctx.lineTo(Math.round(hand.sx) + 0.5, vy1);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = ink.line;
          ctx.beginPath();
          ctx.arc(xAt(i), yAt(price[i]), 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const s = now / 1000;
        hand.sx = W * (0.72 + 0.16 * Math.sin(s * 0.31));
        hand.sy = H * (0.62 + 0.2 * Math.sin(s * 0.53 + 1));
        ctx.save();
        ctx.translate(hand.sx, hand.sy);
        ctx.fillStyle = ink.line;
        ctx.strokeStyle = ink.ground;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 15);
        ctx.lineTo(4, 11.5);
        ctx.lineTo(6.5, 17);
        ctx.lineTo(8.6, 16);
        ctx.lineTo(6.2, 10.6);
        ctx.lineTo(11, 10.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      /* the slip: a slice of the picture moved sideways, a breath of colour either side of it */
      if (glitch > 0) {
        glitch--;
        const sy = Math.round(glitchY * H * dpr);
        const sh = Math.max(1, Math.round(glitchH * H * dpr));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 0.9;
        ctx.drawImage(canvas, 0, sy, canvas.width, sh, glitchDx * dpr, sy, canvas.width, sh);
        /* the colour that leaks at a slip: the call ink one way, the bear's the other, in thin bars across the slice */
        ctx.globalAlpha = 0.4;
        for (let k = 0; k < 5; k++) {
          ctx.fillStyle = k % 2 ? ink.call : ink.down;
          const by = sy + Math.round(((k * 37) % 100) / 100 * sh);
          ctx.fillRect((glitchDx * dpr * (k % 2 ? 1 : -1)) / 2, by, canvas.width, Math.max(1, dpr));
        }
        ctx.globalAlpha = 1;
      }
    };

    /* it draws only while it is seen, with the tab in front — about thirty times a second */
    let raf = 0;
    let seen = false;
    let last = 0;
    const loop = (now: number) => {
      raf = 0;
      if (!seen || document.visibilityState !== 'visible') return;
      if (now - last >= 32) {
        last = now;
        draw(now);
      }
      raf = requestAnimationFrame(loop);
    };
    const go = () => {
      if (calm) return;
      if (!raf && seen && document.visibilityState === 'visible') {
        t0 = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    draw(performance.now());
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      go();
    });
    io.observe(host);
    const ro = new ResizeObserver(() => {
      size();
      draw(performance.now());
    });
    ro.observe(host);
    document.addEventListener('visibilitychange', go);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', go);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <div ref={box} className={`relative w-full overflow-hidden ${className}`} data-footer-art>
      <canvas ref={cvs} aria-hidden="true" className="absolute inset-0 block" />
    </div>
  );
};

export default FooterArt;
