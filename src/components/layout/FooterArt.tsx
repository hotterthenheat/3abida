/*
==================================================
  SLAYER TERMINAL - THE FOOTER, ONE PIECE
  (components/layout/FooterArt.tsx)

  THE TERMINAL IN THE DARK (2026-10-02 — the owner, with
  a photograph of the terminal caught on a black screen,
  only its brightest marks left and broken into pixels:
  "make it super cool like a live footer make some sort
  of artistic thing from the photo"). From 2026-10-02 it
  was a band at the footer's foot; then (2026-10-03 — the
  owner: "i want that glitchy thing and the footer to be
  ONE not the art work and then the footer i want it as
  one art piece") it is THE WHOLE FOOTER: one screen, and
  the footer's words are on it.

  A PICTURE FOR EVERY PAGE (2026-10-03 — the owner: "make
  sure the art footer is on every page … each page had its
  own art work similar to that one but thats representive
  of its page … and then the landing page one you go into
  more depth"). This file is the ENGINE; what the screen
  shows is a SCENE (footer/scenes.ts), picked by the
  address (footer/registry.ts): Pulse's desk, Terrain's
  strike field, Trace's tape, the Dossier's map, the
  book's walls, Compass's cards, the Weigher's curve,
  Paper's orders, the backtest's scrubber, the Journal's
  month — and on the landing every product at once. Each
  is drawn in the photograph's language (footer/kit.ts):
  every mark in coarse pixels with a hair of red on one
  edge and blue on the other, most of the screen gone to
  the ground, specks, levels broken into coloured dashes.
  THE WORDS ARE THE SCREEN'S BRIGHTEST MARKS
  ([data-footer-lit], index.css .footer-word): the same
  hair of red and blue at rest.

  THE POINTER BRINGS IT BACK, anywhere on the footer:
  around it the screen comes into focus — the pixels give
  way to the terminal, sharp; the frames of its panels
  come back round the words ([data-footer-panel]) and
  round the picture's own; the words under it go bright
  and lose their fringe; what is under it reads (a chart's
  crosshair, a row's moment). A pointer that moves fast
  tears the rows it crosses, words and all. Where it has
  been goes dark again in about a second.

  STILL UNTIL A HAND IS ON IT (2026-10-03 — the owner:
  "the illestrative one is always movin on the landing but
  on the rest of the pages its static until the person
  uses their cursor over it"). On the landing (`live`) the
  screen moves whenever it is on screen with the tab in
  front, and with no pointer on it an arrow of its own —
  the photograph's — drifts over it and rests on what it
  reads (it lights no words). Everywhere else it is ONE
  FINISHED FRAME and no animation frame is asked for at
  all: a pointer on it wakes it (its moving parts move,
  the focus, the tears), and once the pointer has gone it
  settles within the focus's fade and stops. A touch wakes
  it for a few seconds. The picture keeps its own clock,
  which runs only while it is awake, so it wakes where it
  stopped. Under reduced motion one still frame, the
  pointer's focus drawn where it stands, the clock moved
  on once a minute.

  Art, not data: no figure on it is a price — the tags are
  the clock, the axis the day's own times. Every ink is a
  token read off the footer's own ground, read again when
  the theme turns: on paper the photograph is printed in
  ink. THE COST: three canvases under the footer; the
  screen's still parts drawn once (again on a resize, a
  turn of theme, a new page's picture), the moving ones
  about thirty times a second (sixty under the pointer),
  only while awake and on screen with the tab in front; a
  word's light and slip are two custom properties, written
  only when they change.
==================================================
*/

import { useEffect, useRef, type ReactNode } from 'react';
import { PHOTO } from '../../embed';
import { ARROW, FONT, PIX, ease, inksOf, rgb, rng, type Box, type Brush, type Frame, type Pen, type Pill, type Scene, type Stage } from './footer/kit';
import { loadScene, type SceneName } from './footer/registry';

/** the focus round the pointer (the picture's px), and how long a place stays lit after the pointer has gone (ms) */
const REACH = 118;
const LINGER = 950;
/** the depth the footer's screen fades up over, out of the page (the picture's px) */
const FADE = 110;
/** the arrow's own pace: a glide from one thing to the next, then a rest on it (ms) */
const GLIDE = 1500;
const REST = 1700;
/** how long a touch keeps a still footer awake (ms) */
const TOUCH = 3600;

/* THE FRINGE'S THREE PASSES over the moving parts: red a pixel left, blue a pixel right, then the marks in their own inks */
const FRINGE = 0.66;

/* THE PAGE'S SCALE (2026-10-06): the landing grows with a big screen as one piece (index.css html[data-landing-scale] —
   the root's font size over 16; 1 under every other page), and the picture grows with it: it is laid and drawn in the
   design's px, its canvases laid over the footer's real size. The coarse pixel stays whole on the screen (PIX times the
   scale times the device's ratio a whole number), so the grain never comes out uneven. */
const scaleOf = (): number => {
  const s = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
  if (s <= 1) return 1;
  const step = PIX * (window.devicePixelRatio || 1);
  return Math.max(1, Math.round(s * step) / step);
};

const run = (host: HTMLDivElement, cvsA: HTMLCanvasElement, cvsB: HTMLCanvasElement, cvsC: HTMLCanvasElement, sc: Scene, live: boolean) => {
  /* THREE LAYERS, so a frame touches only what moves (2026-10-03: one canvas over the whole footer cost a long task a
     frame): A, the broken screen's still parts, in coarse pixels, drawn once; B, the moving parts, coarse too; C, the
     focus round the pointer, the arrow — sharp, and only where they are. A and B are drawn a coarse pixel to a canvas
     pixel and shown pixelated, so the browser does the enlarging. */
  const aCtx = cvsA.getContext('2d');
  const bCtx = cvsB.getContext('2d');
  const cCtx = cvsC.getContext('2d');
  if (!aCtx || !bCtx || !cCtx) return () => {};
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* the arrow of its own: only where the screen moves by itself — and never in the landing's films (the photographer's
     window, embed.ts PHOTO): a film has one pointer, the hand using the page */
  const arrow = live && !calm && !PHOTO;
  /** the page's scale (scaleOf), and a canvas's pixels to one of the picture's px */
  let k = 1;
  let dpr = Math.min(2, window.devicePixelRatio || 1);

  /* and off the page: the still parts broken (coarse) and sharp, and the two the focus is made in */
  const brokenStill = document.createElement('canvas');
  const sharpStill = document.createElement('canvas');
  const focus = document.createElement('canvas');
  const mask = document.createElement('canvas');
  const brkCtx = brokenStill.getContext('2d');
  const sctx = sharpStill.getContext('2d');
  const fctx = focus.getContext('2d');
  const mctx = mask.getContext('2d');
  if (!brkCtx || !sctx || !fctx || !mctx) return () => {};

  /** the footer in the picture's px (its CSS px over the scale), and in CSS px */
  let W = 0;
  let H = 0;
  let cssW = 0;
  let cssH = 0;
  let LW = 0;
  let LH = 0;
  /* NO SIZE, NO DRAWING (2026-10-03: a footer under a hidden ancestor, or laid out to nothing for a moment, sized its sharp
     copy 0 × 0 and the next focus composited it — "The image argument is a canvas element with a width or height of 0"):
     while the footer has no size the screen keeps what it last drew and draws nothing */
  let blank = true;
  /** a canvas that can be drawn from */
  const has = (cv: HTMLCanvasElement) => cv.width > 0 && cv.height > 0;
  let ink = inksOf(host);
  let stage: Stage | null = null;
  /** the picture's box when it was last laid */
  let laidIn: Box | null = null;
  let panels: Box[] = [];
  let words: { el: HTMLElement; box: Box; lit: number; slip: number }[] = [];
  /* the engine's own chance: the screen's glitches, a fast pointer's tears */
  const rand = rng(20261003);

  /* what was drawn out of place last frame — a focus, a tear, the arrow, a word over the focus — to be put back */
  let wasA: Box[] = [];
  let wasC: Box[] = [];
  /* a box in the picture's px, as whole coarse pixels (a pixel's margin round it) */
  const toLo = (r: Box) => {
    const x = Math.max(0, Math.floor(r.x0 / PIX) - 1);
    const y = Math.max(0, Math.floor(r.y0 / PIX) - 1);
    return { x, y, w: Math.min(LW, Math.ceil(r.x1 / PIX) + 1) - x, h: Math.min(LH, Math.ceil(r.y1 / PIX) + 1) - y };
  };
  /* the still screen put back in a box, from its own copy */
  const restoreA = (r: Box) => {
    const q = toLo(r);
    if (q.w <= 0 || q.h <= 0 || !has(brokenStill)) return;
    aCtx.setTransform(1, 0, 0, 1, 0, 0);
    aCtx.globalCompositeOperation = 'source-over';
    aCtx.clearRect(q.x, q.y, q.w, q.h);
    aCtx.drawImage(brokenStill, q.x, q.y, q.w, q.h, q.x, q.y, q.w, q.h);
  };
  /* the sharp layer cleared in a box */
  const clearC = (r: Box) => {
    const x = Math.max(0, Math.floor(r.x0) - 2);
    const y = Math.max(0, Math.floor(r.y0) - 2);
    const w = Math.min(W, Math.ceil(r.x1) + 2) - x;
    const h = Math.min(H, Math.ceil(r.y1) + 2) - y;
    if (w <= 0 || h <= 0) return;
    cCtx.setTransform(1, 0, 0, 1, 0, 0);
    cCtx.clearRect(x * dpr, y * dpr, w * dpr, h * dpr);
  };
  const rel = (el: Element): Box => {
    const r = el.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    return { x0: (r.left - h.left) / k, x1: (r.right - h.left) / k, y0: (r.top - h.top) / k, y1: (r.bottom - h.top) / k };
  };

  /* THE SCREEN'S LAYOUT, in the picture's px, measured off the footer: the picture in the box it marks for it, the frames
     of its panels, and its words */
  const layout = () => {
    const marked = host.querySelector('[data-footer-scene]');
    const inset = W >= 1240 ? (W - 1240) / 2 + 40 : W >= 1024 ? 40 : W >= 640 ? 24 : 16;
    const b = marked ? rel(marked) : { x0: inset, x1: W - inset, y0: 0, y1: H };
    laidIn = b;
    /* a small picture (a phone's, or the short band between the words below lg) keeps to its page's one or two parts; a
       desk's box beside the words is 450 to 560 wide and 300 tall since the footer was halved (2026-10-03) */
    stage = { W, H, box: b, phone: b.x1 - b.x0 < 420 || b.y1 - b.y0 < 260, ink, calm };
    panels = Array.from(host.querySelectorAll('[data-footer-panel]'), rel);
    /* a word's light and slip start from nothing again, so its box is measured where it stands */
    for (const w of words) {
      w.el.style.removeProperty('--lit');
      w.el.style.removeProperty('--slip');
    }
    words = Array.from(host.querySelectorAll<HTMLElement>('[data-footer-lit]'), el => ({ el, box: rel(el), lit: 0, slip: 0 }));
    sc.layout(stage);
  };

  /* ---- THE SCREEN'S STILL PARTS ---------------------------------------------------------------------------------- */

  /* what every picture has: the frames round the words (in focus), and the photograph's grain (broken) */
  const ground = (b: Brush) => {
    const { c } = b;
    if (b.sharp) {
      /* THE PANELS round the words: the screen's own frames come back round what the pointer reads */
      c.strokeStyle = rgb(ink.ink, 0.14);
      c.lineWidth = 1;
      for (const p of panels) {
        c.beginPath();
        c.roundRect(Math.round(p.x0 - 12) + 0.5, Math.round(p.y0 - 10) + 0.5, Math.round(p.x1 - p.x0 + 24), Math.round(p.y1 - p.y0 + 20), 6);
        c.stroke();
        /* a tick at the frame's head, like a panel's title rule */
        c.fillStyle = rgb(ink.ink, 0.22);
        c.fillRect(Math.round(p.x0 - 12), Math.round(p.y0 - 10), 14, 1);
      }
      return;
    }
    /* SPECKS: the photograph's grain — a few pixels and dashes over the whole screen, some in colour */
    const r = b.r;
    const count = Math.round((W * H) / 1400);
    for (let i = 0; i < count; i++) {
      const sx = r() * W;
      const sy = r() * H;
      const hue = r() < 0.18 ? ink.hues[Math.floor(r() * ink.hues.length)] : ink.line;
      c.fillStyle = rgb(hue, 0.12 + r() * 0.4);
      c.fillRect(sx, sy, r() < 0.3 ? 2 + r() * 8 : 2, 2);
    }
    /* and the screen's other cards, all but gone: a corner here and there */
    for (let i = 0; i < Math.round((W * H) / 60000); i++) {
      const cx = r() * W;
      const cy = H * (0.06 + r() * 0.88);
      c.fillStyle = rgb(ink.line, 0.22);
      c.fillRect(cx, cy, 6 + r() * 10, 2);
      c.fillRect(cx, cy, 2, 6);
    }
  };

  /* THE FOOTER COMES UP OUT OF THE PAGE: its first lines fade in from nothing (a canvas, cut by a gradient, once) */
  const rise = (c: CanvasRenderingContext2D, width: number, depth: number) => {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    const g = c.createLinearGradient(0, 0, 0, depth);
    g.addColorStop(0, 'rgb(0 0 0 / 1)');
    g.addColorStop(1, 'rgb(0 0 0 / 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, width, depth);
    c.restore();
  };
  /* the still parts, built: sharp at the screen's own resolution; broken in coarse pixels, a hair of red on the left of
     each mark and blue on the right (each colour a copy of the marks, laid under them a pixel aside) */
  const build = () => {
    if (blank) return;
    sharpStill.width = Math.max(1, Math.round(W * dpr));
    sharpStill.height = Math.max(1, Math.round(H * dpr));
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, W, H);
    const sharp: Brush = { c: sctx, sharp: true, ink, r: rng(11), W, H };
    sc.still(sharp);
    ground(sharp);

    const raw = document.createElement('canvas');
    raw.width = LW;
    raw.height = LH;
    const rctx = raw.getContext('2d');
    if (!rctx) return;
    rctx.setTransform(1 / PIX, 0, 0, 1 / PIX, 0, 0);
    const broken: Brush = { c: rctx, sharp: false, ink, r: rng(12), W, H };
    sc.still(broken);
    ground(broken);
    brokenStill.width = LW;
    brokenStill.height = LH;
    brkCtx.clearRect(0, 0, LW, LH);
    const tint = (hue: string) => {
      const t = document.createElement('canvas');
      t.width = Math.max(1, LW);
      t.height = Math.max(1, LH);
      const tc = t.getContext('2d');
      if (!tc) return t;
      tc.drawImage(raw, 0, 0);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = rgb(hue, 0.85);
      tc.fillRect(0, 0, LW, LH);
      return t;
    };
    brkCtx.drawImage(tint(ink.red), -1, 0);
    brkCtx.drawImage(tint(ink.blue), 1, 0);
    brkCtx.drawImage(raw, 0, 0);
    rise(brkCtx, LW, FADE / PIX);
    rise(sctx, W * dpr, FADE * dpr);
    /* layer A is the broken still whole; B and C start empty */
    aCtx.setTransform(1, 0, 0, 1, 0, 0);
    aCtx.globalCompositeOperation = 'source-over';
    aCtx.clearRect(0, 0, LW, LH);
    aCtx.drawImage(brokenStill, 0, 0);
    bCtx.setTransform(1, 0, 0, 1, 0, 0);
    bCtx.clearRect(0, 0, LW, LH);
    cCtx.setTransform(1, 0, 0, 1, 0, 0);
    cCtx.clearRect(0, 0, cvsC.width, cvsC.height);
    wasA = [];
    wasC = [];
  };

  const size = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    blank = w < 2 || h < 2;
    if (blank) return;
    k = scaleOf();
    dpr = Math.min(2, window.devicePixelRatio || 1) * k;
    cssW = w;
    cssH = h;
    W = w / k;
    H = h / k;
    LW = Math.max(1, Math.ceil(W / PIX));
    LH = Math.max(1, Math.ceil(H / PIX));
    for (const c of [cvsC, focus]) {
      c.width = Math.max(1, Math.round(W * dpr));
      c.height = Math.max(1, Math.round(H * dpr));
    }
    cvsC.style.width = `${W * k}px`;
    cvsC.style.height = `${H * k}px`;
    for (const c of [cvsA, cvsB, mask]) {
      c.width = LW;
      c.height = LH;
    }
    for (const c of [cvsA, cvsB]) {
      c.style.width = `${LW * PIX * k}px`;
      c.style.height = `${LH * PIX * k}px`;
    }
    layout();
    build();
  };

  /* ---- THE HAND AND THE ARROW --------------------------------------------------------------------------------------- */

  /* the picture's own clock: it runs only while the screen is awake */
  let st = 0;
  let last = 0;
  /* the reader's pointer, and the places it has lit (each goes dark over LINGER) */
  const hand = { x: 0, y: 0, on: false, at: 0 };
  const lit: { x: number; y: number; t: number; r: number; hand: boolean }[] = [];
  let tears: { y: number; h: number; dx: number; x0: number; x1: number; until: number; hand: boolean }[] = [];
  /* a touch keeps a still footer awake until then */
  let wakeUntil = 0;
  /* the arrow of its own: where it is, where it set off from, which sight it is on, and when it may set off again */
  const ghost = { x: 0, y: 0, fx: 0, fy: 0, t: 0, leg: 0, show: 0, rest: false, back: 0 };

  /* ---- A FRAME ----------------------------------------------------------------------------------------------------- */

  let wordsAt = 0;
  const pens: [Pen, number][] = [
    [{ c: bCtx, fringe: true, ink: (_h, a = 1) => rgb(ink.red, a * FRINGE) }, -PIX],
    [{ c: bCtx, fringe: true, ink: (_h, a = 1) => rgb(ink.blue, a * FRINGE) }, PIX],
    [{ c: bCtx, fringe: false, ink: (h, a) => rgb(h, a) }, 0],
  ];
  const draw = (now: number, still: boolean) => {
    if (!stage || blank) return;
    const dt = still ? 0 : last ? Math.min(100, now - last) : 16;
    last = still ? 0 : now;
    st += dt;
    const f: Frame = { t: st, dt, wall: Date.now(), seconds: !calm };
    sc.tick(f);

    /* THE ARROW: glides to the next thing, rests on it (on a line, it rides the line), and gives way to a pointer */
    if (arrow) {
      ghost.show += ((hand.on ? 0 : 1) - ghost.show) * (1 - Math.exp(-dt / (hand.on ? 120 : 400)));
      const list = sc.sights(f);
      if (!hand.on && now > ghost.back && list.length) {
        const s = list[ghost.leg % list.length];
        if (!ghost.rest) {
          const q = Math.min(1, Math.max(0, (now - ghost.t) / GLIDE));
          const e = q < 0.5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2;
          ghost.x = ghost.fx + (s.x - ghost.fx) * e;
          ghost.y = ghost.fy + (s.y - ghost.fy) * e;
          if (q >= 1) {
            ghost.rest = true;
            ghost.t = now;
          }
        } else {
          ghost.x = s.x;
          ghost.y = s.y;
          if (now - ghost.t > REST) {
            ghost.rest = false;
            ghost.leg++;
            ghost.fx = ghost.x;
            ghost.fy = ghost.y;
            ghost.t = now;
          }
        }
      }
    }
    /* the place in focus now: the pointer's, or the arrow's */
    const showing = hand.on || (arrow && ghost.show > 0.05);
    const fx = hand.on ? hand.x : ghost.x;
    const fy = hand.on ? hand.y : ghost.y;
    if (showing) {
      const lastLit = lit[lit.length - 1];
      if (!lastLit || Math.hypot(lastLit.x - fx, lastLit.y - fy) > 6 || now - lastLit.t > 60)
        lit.push({ x: fx, y: fy, t: now, r: (hand.on ? REACH : REACH * 0.82) * (stage.phone ? 0.7 : 1), hand: hand.on });
    }
    while (lit.length && (lit.length > 40 || now - lit[0].t > LINGER)) lit.shift();
    tears = tears.filter(t => t.until > now);

    /* WHAT IS OUT OF PLACE THIS FRAME: the focus's box (snapped to the coarse grid), the rows torn, the arrow */
    let focusBox: Box | null = null;
    if (lit.length) {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const l of lit) {
        if (now - l.t >= LINGER) continue;
        x0 = Math.min(x0, l.x - l.r);
        y0 = Math.min(y0, l.y - l.r);
        x1 = Math.max(x1, l.x + l.r);
        y1 = Math.max(y1, l.y + l.r);
      }
      x0 = Math.max(0, Math.floor(x0 / PIX) * PIX);
      y0 = Math.max(0, Math.floor(y0 / PIX) * PIX);
      x1 = Math.min(LW * PIX, Math.ceil(x1 / PIX) * PIX);
      y1 = Math.min(LH * PIX, Math.ceil(y1 / PIX) * PIX);
      if (x1 > x0 && y1 > y0) focusBox = { x0, y0, x1, y1 };
    }
    const tearBoxes = tears.map(t => ({ x0: Math.max(0, Math.min(t.x0, t.x0 + t.dx)), x1: Math.min(W, Math.max(t.x1, t.x1 + t.dx)), y0: t.y, y1: t.y + t.h }));

    /* 1 · THE STILL SCREEN (layer A): what was drawn over last frame is put back, and the rows torn now slip */
    for (const r of wasA) restoreA(r);
    for (const r of tearBoxes) restoreA(r);
    if (focusBox) restoreA(focusBox);
    aCtx.imageSmoothingEnabled = false;
    for (const t of tears) {
      const q = toLo({ x0: Math.max(0, t.x0), x1: Math.min(W, t.x1), y0: t.y, y1: t.y + t.h });
      if (q.w > 0 && q.h > 0 && has(brokenStill)) aCtx.drawImage(brokenStill, q.x, q.y, q.w, q.h, q.x + Math.round(t.dx / PIX), q.y, q.w, q.h);
    }

    /* 2 · THE MOVING PARTS (layer B), in their own box only, fringed: a red pass, a blue pass, the marks */
    const mb = sc.live();
    if (mb) {
      const sb = toLo(mb);
      bCtx.setTransform(1, 0, 0, 1, 0, 0);
      bCtx.globalCompositeOperation = 'source-over';
      bCtx.clearRect(sb.x, sb.y, sb.w, sb.h);
      for (const [pen, dx] of pens) {
        bCtx.setTransform(1 / PIX, 0, 0, 1 / PIX, dx / PIX, 0);
        sc.moving(pen, f);
      }
      /* the moving parts tear with the rest */
      bCtx.setTransform(1, 0, 0, 1, 0, 0);
      bCtx.imageSmoothingEnabled = false;
      for (const t of tears) {
        const q = toLo({ x0: Math.max(mb.x0, t.x0), x1: Math.min(mb.x1, t.x1), y0: t.y, y1: t.y + t.h });
        if (q.w > 0 && q.h > 0 && has(cvsB)) bCtx.drawImage(cvsB, q.x, q.y, q.w, q.h, q.x + Math.round(t.dx / PIX), q.y, q.w, q.h);
      }
    }
    /* the screen's own glitch: now and then a row slips sideways for a moment (on a still page only under the hand) */
    if (!calm && (live || hand.on) && rand() < dt / 2200) {
      const y = Math.floor(rand() * LH);
      tears.push({ y: y * PIX, h: (1 + Math.floor(rand() * 3)) * PIX, dx: (rand() - 0.5) * 40, x0: 0, x1: W, until: now + 110, hand: false });
    }

    /* 3 · THE FOCUS (layer C): where the pointer (or the arrow) is and has been, the broken screen gives way and the
       terminal comes back, sharp — only in the focus's own box */
    for (const r of wasC) clearC(r);
    let pills: Pill[] | null = null;
    if (focusBox && has(mask) && has(focus) && has(sharpStill)) {
      const { x0: bx0, y0: by0, x1: bx1, y1: by1 } = focusBox;
      const bw = bx1 - bx0;
      const bh = by1 - by0;
      const lx = bx0 / PIX;
      const ly = by0 / PIX;
      const lw = bw / PIX;
      const lh = bh / PIX;
      clearC(focusBox);
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.clearRect(lx, ly, lw, lh);
      for (const l of lit) {
        const s = Math.max(0, 1 - (now - l.t) / LINGER);
        if (s <= 0) continue;
        const g = mctx.createRadialGradient(l.x / PIX, l.y / PIX, 0, l.x / PIX, l.y / PIX, l.r / PIX);
        g.addColorStop(0, `rgb(0 0 0 / ${s})`);
        g.addColorStop(0.45, `rgb(0 0 0 / ${s * 0.9})`);
        g.addColorStop(1, 'rgb(0 0 0 / 0)');
        mctx.fillStyle = g;
        mctx.fillRect((l.x - l.r) / PIX, (l.y - l.r) / PIX, (2 * l.r) / PIX, (2 * l.r) / PIX);
      }
      /* the broken screen gives way under it (A and B, cut by the mask) */
      for (const c of [aCtx, bCtx]) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalCompositeOperation = 'destination-out';
        c.drawImage(mask, lx, ly, lw, lh, lx, ly, lw, lh);
        c.globalCompositeOperation = 'source-over';
      }
      /* the sharp terminal in the lit box: its still parts, its moving parts clean, and what the pointer reads */
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.globalCompositeOperation = 'source-over';
      fctx.clearRect(bx0, by0, bw, bh);
      fctx.save();
      fctx.beginPath();
      fctx.rect(bx0, by0, bw, bh);
      fctx.clip();
      fctx.drawImage(sharpStill, bx0 * dpr, by0 * dpr, bw * dpr, bh * dpr, bx0, by0, bw, bh);
      sc.sharp(fctx, f, focusBox);
      if (showing) pills = sc.read(fctx, f, fx, fy);
      fctx.restore();
      /* only what is lit: the focus cut to the mask, and laid in */
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.globalCompositeOperation = 'destination-in';
      fctx.imageSmoothingEnabled = true;
      fctx.drawImage(mask, lx, ly, lw, lh, bx0 * dpr, by0 * dpr, bw * dpr, bh * dpr);
      fctx.globalCompositeOperation = 'source-over';
      cCtx.setTransform(1, 0, 0, 1, 0, 0);
      cCtx.drawImage(focus, bx0 * dpr, by0 * dpr, bw * dpr, bh * dpr, bx0 * dpr, by0 * dpr, bw * dpr, bh * dpr);
    }
    /* what the pointer reads (the moment under a crosshair, a row's time) — over the mask, so it reads wherever the pointer
       is (it was cut away outside the lit place: 2026-10-03 audit) */
    const pillBoxes: Box[] = [];
    if (pills) {
      cCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cCtx.font = `500 10.5px ${FONT}`;
      cCtx.textBaseline = 'middle';
      cCtx.textAlign = 'center';
      for (const q of pills) {
        const ww = cCtx.measureText(q.text).width + 14;
        const x = q.anchor === 'left' ? q.x : q.anchor === 'right' ? q.x - ww : q.x - ww / 2;
        const y = q.y - 9;
        cCtx.fillStyle = rgb(ink.line);
        cCtx.beginPath();
        cCtx.roundRect(x, y, ww, 18, 3);
        cCtx.fill();
        cCtx.fillStyle = rgb(ink.panel);
        cCtx.fillText(q.text, x + ww / 2, y + 9.5);
        pillBoxes.push({ x0: x, y0: y, x1: x + ww, y1: y + 18 });
      }
      cCtx.textAlign = 'left';
      cCtx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /* 4 · THE ARROW of its own, while no pointer is on the screen */
    let arrowBox: Box | null = null;
    if (arrow && ghost.show > 0.02) {
      arrowBox = { x0: ghost.x - 3, y0: ghost.y - 3, x1: ghost.x + 15, y1: ghost.y + 22 };
      clearC(arrowBox);
      cCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cCtx.globalAlpha = ghost.show;
      cCtx.beginPath();
      ARROW.forEach(([ax, ay], i) => (i ? cCtx.lineTo(ghost.x + ax, ghost.y + ay) : cCtx.moveTo(ghost.x + ax, ghost.y + ay)));
      cCtx.closePath();
      cCtx.fillStyle = rgb(ink.line);
      cCtx.fill();
      cCtx.strokeStyle = rgb(ink.panel);
      cCtx.lineWidth = 1;
      cCtx.stroke();
      cCtx.globalAlpha = 1;
      cCtx.setTransform(1, 0, 0, 1, 0, 0);
    }
    /* what is out of place now, to be put back next frame */
    wasA = focusBox ? [focusBox, ...tearBoxes] : tearBoxes;
    wasC = [focusBox, arrowBox, ...pillBoxes].filter((b): b is Box => !!b);

    /* 5 · THE WORDS: lit where the reader's pointer is and has been (the arrow of its own lights none), and torn with the
       rows a fast pointer tears — thirty times a second at most, in twelfths, each written only when it changes (a word
       drawn again is its text and its fringe painted again) */
    if (now - wordsAt < 30 && hand.on) return;
    wordsAt = now;
    for (const w of words) {
      let v = 0;
      for (const l of lit) {
        if (!l.hand) continue;
        const s = 1 - (now - l.t) / LINGER;
        if (s <= 0) continue;
        const dx = l.x < w.box.x0 ? w.box.x0 - l.x : l.x > w.box.x1 ? l.x - w.box.x1 : 0;
        const dy = l.y < w.box.y0 ? w.box.y0 - l.y : l.y > w.box.y1 ? l.y - w.box.y1 : 0;
        const near = 1 - Math.hypot(dx, dy) / (l.r * 0.85);
        if (near > 0) v = Math.max(v, s * ease(Math.min(1, near * 1.4)));
      }
      let slip = 0;
      for (const t of tears) if (t.hand && t.y < w.box.y1 && t.y + t.h > w.box.y0 && t.x1 > w.box.x0 && t.x0 < w.box.x1) slip += t.dx * 0.3;
      slip = Math.round(Math.max(-9, Math.min(9, slip)));
      v = Math.round(v * 12) / 12;
      if (v !== w.lit) {
        w.lit = v;
        if (w.lit) w.el.style.setProperty('--lit', w.lit.toFixed(2));
        else w.el.style.removeProperty('--lit');
      }
      if (slip !== w.slip) {
        w.slip = slip;
        if (slip) w.el.style.setProperty('--slip', `${slip * k}px`);
        else w.el.style.removeProperty('--slip');
      }
    }
  };

  /* ---- WHEN IT DRAWS ----------------------------------------------------------------------------------------------- */

  let raf = 0;
  let seen = false;
  let drawn = 0;
  /* awake: on the landing whenever seen; elsewhere while a hand is on it, a touch's moment lasts, or a lit place or a
     tear is still fading */
  const awake = (now: number) => live || hand.on || now < wakeUntil || lit.some(l => now - l.t < LINGER) || tears.some(t => t.until > now);
  const loop = (now: number) => {
    raf = 0;
    if (!seen || document.visibilityState !== 'visible') {
      last = 0;
      return;
    }
    const busy = awake(now);
    if (!busy || now - drawn >= (hand.on ? 15 : 32)) {
      drawn = now;
      draw(now, false);
    }
    /* SETTLED: the frame just drawn is the still one, and no frame is asked for until a hand comes back */
    if (!awake(now)) {
      last = 0;
      return;
    }
    raf = requestAnimationFrame(loop);
  };
  const go = () => {
    if (calm || raf || !seen || document.visibilityState !== 'visible' || !awake(performance.now())) return;
    last = 0;
    raf = requestAnimationFrame(loop);
  };
  /* under reduced motion the frame stands still; its clock moves on once a minute while it is seen */
  let tick = 0;
  const minute = () => {
    window.clearTimeout(tick);
    if (!calm || !seen) return;
    draw(performance.now(), true);
    tick = window.setTimeout(minute, 60_000 - (Date.now() % 60_000) + 50);
  };
  const redraw = () => {
    if (!raf) draw(performance.now(), true);
  };

  const move = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    const x = (e.clientX - r.left) / k;
    const y = (e.clientY - r.top) / k;
    const now = performance.now();
    /* a pointer that moves fast tears the rows it crosses */
    if (hand.on && !calm) {
      const sp = Math.hypot(x - hand.x, y - hand.y) / Math.max(1, now - hand.at);
      if (sp > 0.9) {
        const dir = Math.sign(x - hand.x) || 1;
        for (let i = 0; i < 3; i++)
          tears.push({ y: Math.round(y + (rand() - 0.5) * 70), h: 2 + Math.floor(rand() * 7), dx: dir * (6 + rand() * 22) * Math.min(2, sp), x0: x - 150, x1: x + 150, until: now + 140 + rand() * 90, hand: true });
      }
    }
    hand.x = x;
    hand.y = y;
    hand.at = now;
    hand.on = true;
    /* a touch has no hover: it wakes the screen for a few seconds */
    if (e.pointerType !== 'mouse') wakeUntil = now + TOUCH;
    if (calm) {
      lit.length = 0;
      draw(now, true);
      return;
    }
    go();
  };
  const leave = () => {
    if (!hand.on) return;
    hand.on = false;
    const now = performance.now();
    /* the arrow takes over from where the pointer left, after a moment */
    ghost.x = ghost.fx = hand.x;
    ghost.y = ghost.fy = hand.y;
    ghost.rest = false;
    ghost.t = now + 1200;
    ghost.back = now + 1200;
    if (calm) {
      lit.length = 0;
      draw(now, true);
      return;
    }
    go();
  };
  const up = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') leave();
  };

  size();
  /* the arrow sets off from the middle of the picture */
  const first = stage as Stage | null;
  if (first) {
    ghost.x = ghost.fx = (first.box.x0 + first.box.x1) / 2;
    ghost.y = ghost.fy = H * 0.4;
  }
  /* THE FIRST FRAME: finished, the picture's clock at its start */
  draw(performance.now(), true);

  /* the pointer is read over the whole footer — the words and the links are on the screen, not over it */
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerdown', move);
  host.addEventListener('pointerleave', leave);
  host.addEventListener('pointercancel', leave);
  host.addEventListener('pointerup', up);
  const io = new IntersectionObserver(([e]) => {
    const arriving = e.isIntersecting && !seen;
    seen = e.isIntersecting;
    if (calm) return minute();
    /* a still footer is photographed as the reader arrives at it: one frame, its tags the moment now (no frame asked for) */
    if (arriving && !live && !raf) draw(performance.now(), true);
    go();
  });
  io.observe(host);
  const ro = new ResizeObserver(() => {
    if (!blank && host.clientWidth === cssW && host.clientHeight === cssH && scaleOf() === k) return;
    size();
    redraw();
  });
  ro.observe(host);
  /* THE PICTURE'S BOX CAN CHANGE WITH THE FOOTER'S SIZE UNCHANGED — the landing's column follows the screen's height
     (index.css --landing-col), so a window made shorter moves the words and the box under a footer just as wide and
     tall — so the box is watched too, and the picture laid again where it has gone */
  const scene = host.querySelector('[data-footer-scene]');
  const ro2 = new ResizeObserver(() => {
    if (blank || !scene || !laidIn) return;
    const b = rel(scene);
    if (Math.abs(b.x0 - laidIn.x0) < 0.5 && Math.abs(b.x1 - laidIn.x1) < 0.5 && Math.abs(b.y0 - laidIn.y0) < 0.5 && Math.abs(b.y1 - laidIn.y1) < 0.5) return;
    layout();
    build();
    redraw();
  });
  if (scene) ro2.observe(scene);
  /* the words are measured where they stand: once the type is in, again (a word's box moves when its font arrives) */
  let alive = true;
  document.fonts?.ready.then(() => {
    if (!alive || blank) return;
    layout();
    build();
    redraw();
  });
  /* a theme turn: every ink read again once the new ground is on the page, the still parts drawn again */
  let themed = 0;
  const mo = new MutationObserver(() => {
    cancelAnimationFrame(themed);
    themed = requestAnimationFrame(() => {
      ink = inksOf(host);
      if (blank) return;
      layout();
      build();
      redraw();
    });
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'], subtree: true });
  document.addEventListener('visibilitychange', go);
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(themed);
    window.clearTimeout(tick);
    io.disconnect();
    ro.disconnect();
    ro2.disconnect();
    mo.disconnect();
    document.removeEventListener('visibilitychange', go);
    host.removeEventListener('pointermove', move);
    host.removeEventListener('pointerdown', move);
    host.removeEventListener('pointerleave', leave);
    host.removeEventListener('pointercancel', leave);
    host.removeEventListener('pointerup', up);
    for (const w of words) {
      w.el.style.removeProperty('--lit');
      w.el.style.removeProperty('--slip');
    }
  };
};

/** The whole footer as one screen: `scene` is the picture (the page's own), `live` the landing's — it moves whenever seen;
    everywhere else the picture stands still until a hand is on it */
const FooterArt = ({ children, className = '', scene = 'pulse', live = false }: { children: ReactNode; className?: string; scene?: SceneName; live?: boolean }) => {
  const box = useRef<HTMLDivElement | null>(null);
  const layerA = useRef<HTMLCanvasElement | null>(null);
  const layerB = useRef<HTMLCanvasElement | null>(null);
  const layerC = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = box.current;
    const cvsA = layerA.current;
    const cvsB = layerB.current;
    const cvsC = layerC.current;
    if (!host || !cvsA || !cvsB || !cvsC) return;
    let alive = true;
    let stop: (() => void) | undefined;
    let idle = 0;
    /* the picture's code arrives on its own (registry.ts), and the screen is built when the page has a moment — the footer
       stands under everything a page opens with */
    loadScene(scene).then(
      make => {
        if (!alive) return;
        const start = () => {
          if (alive) stop = run(host, cvsA, cvsB, cvsC, make(), live);
        };
        idle = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(start, { timeout: 900 }) : window.setTimeout(start, 120);
      },
      () => {},
    );
    return () => {
      alive = false;
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      stop?.();
    };
  }, [scene, live]);

  return (
    <div ref={box} className={`relative isolate w-full ${className}`} data-footer-art={scene}>
      {/* under everything the footer holds (its fade up out of the page is drawn into the still parts: a mask over the layers
          made the browser lay the whole footer again each frame) */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <canvas ref={layerA} className="absolute left-0 top-0 block [image-rendering:pixelated]" />
        <canvas ref={layerB} className="absolute left-0 top-0 block [image-rendering:pixelated]" />
        <canvas ref={layerC} className="absolute left-0 top-0 block" />
      </div>
      {children}
    </div>
  );
};

export default FooterArt;
