/*
==================================================
  SLAYER TERMINAL - THE FOOTER'S KIT
  (components/layout/footer/kit.ts)

  What every picture on the footer is drawn with: the
  photograph's language in one place (2026-10-03 — the
  owner: "each page had its own art work similar to that
  one but thats representive of its page … keep the same
  artistic language"). The engine (FooterArt.tsx) breaks
  and lights the screen; a scene (scenes.ts) is only its
  own picture, made of parts (parts/*.ts), each drawn
  with these:

    THE BRUSH   the still parts. Drawn twice: SHARP (the
                terminal as it is, every mark, crisp) and
                BROKEN (coarse — a share of each mark
                survives, a line is its dashes, a bar a
                piece of itself, a word some of its
                letters). The engine lays a hair of red
                and of blue under the broken copy.
    THE PEN     the moving parts, coarse, drawn three
                times a frame: a red pass a pixel left, a
                blue pass a pixel right, then the marks in
                their own inks. Words only on the last.
    THE WALK    a price line with momentum, leaning back
                to where it began — the photograph's line,
                and every sparkline and curve that walks.

  Art, not data: no figure drawn is a price. The tags are
  the clock (New York's), a calendar says its days.
==================================================
*/

import { FONT_SANS } from '../../../theme/fonts';

/** the broken screen's pixel, in CSS px */
export const PIX = 2;
export const FONT = FONT_SANS;

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
export const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0, y0, x1, y1 });
export const grow = (b: Box, mx: number, my = mx): Box => ({ x0: b.x0 - mx, x1: b.x1 + mx, y0: b.y0 - my, y1: b.y1 + my });
export const within = (b: Box, x: number, y: number, m = 0) => x >= b.x0 - m && x <= b.x1 + m && y >= b.y0 - m && y <= b.y1 + m;
export const meets = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
export const union = (list: (Box | null | undefined)[]): Box | null => {
  let out: Box | null = null;
  for (const b of list) {
    if (!b) continue;
    out = out ? { x0: Math.min(out.x0, b.x0), y0: Math.min(out.y0, b.y0), x1: Math.max(out.x1, b.x1), y1: Math.max(out.y1, b.y1) } : { ...b };
  }
  return out;
};
/** a share of a box, its corners given as shares of its width and height */
export const cut = (b: Box, l: number, t: number, r: number, btm: number): Box => {
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  return { x0: b.x0 + w * l, x1: b.x0 + w * r, y0: b.y0 + h * t, y1: b.y0 + h * btm };
};

/** a seeded stream, so the screen opens on the same picture every time */
export const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
/** one number from another, spread over 0–1 (a stream's first draw barely moves between nearby seeds; this does) */
export const hash01 = (n: number) => {
  let x = Math.floor(n) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** smoothstep */
export const ease = (t: number) => t * t * (3 - 2 * t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** a whole coarse pixel */
export const snap = (v: number) => Math.round(v / PIX) * PIX;

/* ---- THE INKS --------------------------------------------------------------------------------------------------- */

/** a token's channels ("237 237 237"), read where the footer stands */
const chan = (el: Element, name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;
export const rgb = (c: string, a?: number) => (a == null ? `rgb(${c})` : `rgb(${c} / ${Math.max(0, Math.min(1, a))})`);

export interface Ink {
  line: string;
  secondary: string;
  muted: string;
  ink: string;
  panel: string;
  red: string;
  blue: string;
  bull: string;
  warn: string;
  ember: string;
  moon: string;
  supreme: string;
  cool: string;
  warm: string;
  glacier: string;
  darkpool: string;
  flip: string;
  silver: string;
  /** the photograph's colours, the terminal's own: the levels, the ladder's two sides, the chips */
  hues: string[];
}
export const inksOf = (el: Element): Ink => {
  const red = chan(el, '--bear', '255 59 48');
  const blue = chan(el, '--compare', '91 156 246');
  const moon = chan(el, '--moon', '185 169 244');
  const warn = chan(el, '--warn', '255 149 0');
  const cool = chan(el, '--thermal-cool', '88 139 192');
  const supreme = chan(el, '--supreme', '234 0 255');
  return {
    line: chan(el, '--text-primary', '237 237 237'),
    secondary: chan(el, '--text-secondary', '163 163 163'),
    muted: chan(el, '--text-muted', '125 125 125'),
    ink: chan(el, '--ink', '255 255 255'),
    panel: chan(el, '--panel', '10 10 10'),
    red,
    blue,
    bull: chan(el, '--bull', '48 209 88'),
    warn,
    ember: chan(el, '--ember', '245 197 66'),
    moon,
    supreme,
    cool,
    warm: chan(el, '--thermal-warm', '227 72 50'),
    glacier: chan(el, '--glacier', '122 189 215'),
    darkpool: chan(el, '--darkpool', '45 212 191'),
    flip: chan(el, '--flip', '156 163 175'),
    silver: chan(el, '--select', '199 211 232'),
    hues: [blue, moon, red, warn, cool, supreme],
  };
};

/* ---- THE CLOCK -------------------------------------------------------------------------------------------------- */

/* THE CLOCK IS NEW YORK'S, as the signature's is (brand/useMarketClock.ts) — the market's own hours, whatever the reader's */
const NY_S = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const NY_M = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const clock = (ms: number, seconds: boolean) => (seconds ? NY_S : NY_M).format(ms);
const WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });
const DATE = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', day: 'numeric' });
/** a day's own words ("Wed 2") — the calendar's, never a price */
export const dayWord = (ms: number) => `${WEEKDAY.format(ms)} ${DATE.format(ms)}`;

/* ---- THE STAGE, A FRAME, A PART --------------------------------------------------------------------------------- */

/** where a scene is drawn: the footer (CSS px), the box it marks for the picture, its inks */
export interface Stage {
  W: number;
  H: number;
  /** the box the footer marks for the picture ([data-footer-scene]) */
  box: Box;
  /** a small picture: a phone's, or the short band between the words below lg — its page's one or two parts */
  phone: boolean;
  ink: Ink;
  calm: boolean;
}
/** one frame's moment */
export interface Frame {
  /** the picture's own clock (ms): it runs only while the piece is awake, so a still footer wakes where it stopped */
  t: number;
  /** ms since the last frame (0 for a still frame) */
  dt: number;
  /** the wall's clock — every tag reads it */
  wall: number;
  /** tags in seconds (not under reduced motion, whose frame moves on once a minute) */
  seconds: boolean;
}
/** a word laid over the focus (the crosshair's moment, a row's time): `x` is its middle, or its left edge */
export interface Pill {
  x: number;
  y: number;
  text: string;
  anchor?: 'mid' | 'left' | 'right';
}
/** the still parts' context: sharp (everything) or broken (a share survives) */
export interface Brush {
  c: CanvasRenderingContext2D;
  sharp: boolean;
  ink: Ink;
  r: () => number;
  W: number;
  H: number;
}
/** the moving parts' context, one pass of three: a fringe pass draws everything in its tint and leaves the words out */
export interface Pen {
  c: CanvasRenderingContext2D;
  fringe: boolean;
  ink: (hue: string, a?: number) => string;
}
/** a piece of a picture, placed in a box */
export interface Part {
  place(b: Box, s: Stage): void;
  /** the still parts, drawn once sharp and once broken */
  still(b: Brush): void;
  /** the part's clock moves on */
  tick?(f: Frame): void;
  /** the box its moving parts are drawn in */
  live?(): Box | null;
  /** the moving parts, coarse — one pass of the fringe's three */
  moving?(p: Pen, f: Frame): void;
  /** the moving parts sharp, in the focus (the context in CSS px, clipped to the focus) */
  sharp?(c: CanvasRenderingContext2D, f: Frame, focus: Box): void;
  /** what the pointer reads at (x, y): guides drawn into the focus, words to lay over it */
  read?(c: CanvasRenderingContext2D, f: Frame, x: number, y: number): Pill[] | null;
  /** where the footer's own arrow rests, in turn */
  sights?(f: Frame): { x: number; y: number }[];
}
/** a whole picture: what the engine draws */
export interface Scene {
  layout(s: Stage): void;
  still(b: Brush): void;
  tick(f: Frame): void;
  live(): Box | null;
  moving(p: Pen, f: Frame): void;
  sharp(c: CanvasRenderingContext2D, f: Frame, focus: Box): void;
  read(c: CanvasRenderingContext2D, f: Frame, x: number, y: number): Pill[] | null;
  sights(f: Frame): { x: number; y: number }[];
}
export type SceneMaker = () => Scene;

/** A SCENE IS ITS PARTS, each in the box `arrange` gives it for the stage (a part left out of a phone's picture gets no box) */
export const compose = (parts: Part[], arrange: (s: Stage) => (Box | null)[]): Scene => {
  let shown: Part[] = [];
  return {
    layout(s) {
      const boxes = arrange(s);
      shown = [];
      parts.forEach((p, i) => {
        const b = boxes[i];
        if (!b) return;
        p.place(b, s);
        shown.push(p);
      });
    },
    still: b => shown.forEach(p => p.still(b)),
    tick: f => shown.forEach(p => p.tick?.(f)),
    live: () => union(shown.map(p => p.live?.())),
    moving: (pen, f) => shown.forEach(p => p.moving?.(pen, f)),
    sharp: (c, f, focus) =>
      shown.forEach(p => {
        const l = p.live?.();
        if (p.sharp && (!l || meets(l, focus))) p.sharp(c, f, focus);
      }),
    /* the front part reads first: the last one drawn stands over the others */
    read(c, f, x, y) {
      for (let i = shown.length - 1; i >= 0; i--) {
        const out = shown[i].read?.(c, f, x, y);
        if (out) return out;
      }
      return null;
    },
    sights: f => shown.flatMap(p => p.sights?.(f) ?? []),
  };
};

/** DEPTH: a part further back — its broken marks and its moving ones at a share of their light; in focus it comes back
    whole, as everything does */
export const dim = (p: Part, k: number): Part => ({
  ...p,
  still(b) {
    if (b.sharp) return p.still(b);
    const a = b.c.globalAlpha;
    b.c.globalAlpha = a * k;
    p.still(b);
    b.c.globalAlpha = a;
  },
  moving: p.moving
    ? (pen, f) => {
        const a = pen.c.globalAlpha;
        pen.c.globalAlpha = a * k;
        p.moving!(pen, f);
        pen.c.globalAlpha = a;
      }
    : undefined,
});

/* ---- THE BRUSH -------------------------------------------------------------------------------------------------- */

/** a share of the broken copy survives; the sharp copy keeps everything */
export const keep = (b: Brush, share: number) => b.sharp || b.r() < share;

/** words in the screen's own small type, letter by letter — so the broken copy can lose some of them */
export const type = (
  b: Brush,
  text: string,
  x: number,
  y: number,
  o: { size?: number; hue?: string; a?: number; share?: number; weight?: number; align?: 'left' | 'right' | 'center' } = {},
) => {
  const { c } = b;
  c.font = `${o.weight ?? 600} ${o.size ?? 9.5}px ${FONT}`;
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  c.fillStyle = rgb(o.hue ?? b.ink.line, o.a ?? 1);
  const w = c.measureText(text).width;
  let at = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
  const share = o.share ?? 0.6;
  for (const ch of text) {
    if (keep(b, share)) c.fillText(ch, at, y);
    at += c.measureText(ch).width;
  }
  return w;
};

/** a run of dashes from `from` to `to`, the same every time (the photograph's broken lines) */
export const dashes = (r: () => number, from: number, to: number, gap: number, min = 5, span = 34): [number, number][] => {
  const out: [number, number][] = [];
  for (let x = from + r() * 20; x < to; ) {
    const len = min + r() * span;
    out.push([x, Math.min(to, x + len)]);
    x += len + 4 + r() * gap;
  }
  return out;
};

/** a line across: sharp, a hairline; broken, the dashes of `segs` that survive (fill style set by the caller) */
export const hair = (b: Brush, x0: number, x1: number, y: number, segs: [number, number][], share = 0.4) => {
  if (b.sharp) return b.c.fillRect(x0, Math.round(y) - 0.5, x1 - x0, 1);
  for (const [a, e] of segs) if (b.r() < share) b.c.fillRect(a, y - 1, e - a, 2);
};
/** a line down: sharp, a hairline; broken, pieces of it */
export const hairDown = (b: Brush, x: number, y0: number, y1: number, share = 0.4) => {
  if (b.sharp) return b.c.fillRect(Math.round(x) - 0.5, y0, 1, y1 - y0);
  for (let y = y0 + b.r() * 8; y < y1; y += 6 + b.r() * 18) if (b.r() < share) b.c.fillRect(x - 1, y, 2, Math.min(y1 - y, 3 + b.r() * 12));
};

/** a bar (a strike's, a row's): sharp, whole; broken, a piece or two of itself, or gone (fill style set by the caller) */
export const bar = (b: Brush, x: number, y: number, w: number, h: number, share = 0.45) => {
  if (w <= 0 || h <= 0) return;
  if (b.sharp) return b.c.fillRect(x, y, w, h);
  if (b.r() > share) return;
  const a = x + b.r() * w * 0.6;
  b.c.fillRect(a, y, Math.max(4, w * (0.2 + b.r() * 0.35)), Math.max(2, h - 1));
};

/** a panel's frame and the tick at its head — only in focus: the screen's own frames come back round what the pointer reads */
export const frame = (b: Brush, x: Box, o: { a?: number; radius?: number; title?: string; grip?: boolean } = {}) => {
  if (!b.sharp) {
    /* broken, a frame is a corner or two of itself */
    const { c } = b;
    c.fillStyle = rgb(b.ink.line, 0.2);
    if (b.r() < 0.3) {
      c.fillRect(x.x0, x.y0, 8 + b.r() * 10, 2);
      c.fillRect(x.x0, x.y0, 2, 6 + b.r() * 6);
    }
    if (b.r() < 0.2) {
      c.fillRect(x.x1 - 12, x.y1 - 2, 12, 2);
      c.fillRect(x.x1 - 2, x.y1 - 8, 2, 8);
    }
    if (o.title) type(b, o.title, x.x0 + (o.grip ? 18 : 8), x.y0 + 9, { size: 8.5, hue: b.ink.secondary, a: 0.7, share: 0.4 });
    return;
  }
  const { c } = b;
  c.strokeStyle = rgb(b.ink.ink, o.a ?? 0.12);
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(Math.round(x.x0) + 0.5, Math.round(x.y0) + 0.5, Math.round(x.x1 - x.x0), Math.round(x.y1 - x.y0), o.radius ?? 5);
  c.stroke();
  c.fillStyle = rgb(b.ink.ink, 0.22);
  c.fillRect(Math.round(x.x0), Math.round(x.y0), 14, 1);
  if (o.grip) {
    c.fillStyle = rgb(b.ink.muted, 0.8);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) c.fillRect(x.x0 + 7 + i * 3, x.y0 + 7 + j * 3, 1.5, 1.5);
  }
  if (o.title) type(b, o.title, x.x0 + (o.grip ? 20 : 8), x.y0 + 9, { size: 8.5, hue: b.ink.line, a: 0.9 });
};

/** a card's outline as the broken screen keeps it: its edge in dashes, a share of them (stroke style set by the caller) */
export const dashedCard = (b: Brush, x: Box, radius = 8, share = 0.6) => {
  const { c } = b;
  c.lineWidth = 2;
  c.setLineDash([6 + b.r() * 6, 5 + b.r() * 8]);
  c.lineDashOffset = b.r() * 20;
  if (b.r() < share) {
    c.beginPath();
    c.roundRect(x.x0, x.y0, x.x1 - x.x0, x.y1 - x.y0, radius);
    c.stroke();
  }
  c.setLineDash([]);
  c.lineDashOffset = 0;
};

/** gridlines across a box — only in focus */
export const gridlines = (b: Brush, x: Box, rows: number, a = 0.06) => {
  if (!b.sharp) return;
  b.c.fillStyle = rgb(b.ink.ink, a);
  for (let k = 1; k < rows; k++) b.c.fillRect(x.x0, Math.round(x.y0 + ((x.y1 - x.y0) * k) / rows), x.x1 - x.x0, 1);
};

/** a chip: a pill, filled or edged, a word in it — the setup cards' */
export const chip = (b: Brush, x: number, y: number, w: number, o: { fill?: string | null; edge?: string | null; word: string; wordInk: string; share?: number; h?: number }) => {
  const { c } = b;
  const h = o.h ?? 14;
  if (!keep(b, o.share ?? 0.65)) return w;
  if (o.fill) {
    c.fillStyle = o.fill;
    c.beginPath();
    c.roundRect(x, y - h / 2, w, h, h / 2);
    c.fill();
  }
  if (o.edge) {
    c.strokeStyle = o.edge;
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(x + 0.75, y - h / 2 + 0.75, w - 1.5, h - 1.5, h / 2 - 1);
    c.stroke();
  }
  if (o.word) type(b, o.word, x + 7, y + 0.5, { size: 8.5, hue: o.wordInk, share: 0.55 });
  return w;
};
/** a tag: a small box with a word, square-cornered (the terminal's contract tags) */
export const tag = (b: Brush, x: number, y: number, word: string, o: { edge: string; fill?: string | null; wordInk?: string; size?: number; share?: number }) => {
  const { c } = b;
  c.font = `600 ${o.size ?? 8.5}px ${FONT}`;
  const w = c.measureText(word).width + 10;
  if (!keep(b, o.share ?? 0.6)) return w;
  if (o.fill) {
    c.fillStyle = o.fill;
    c.fillRect(x, y - 7, w, 14);
  }
  c.strokeStyle = o.edge;
  c.lineWidth = b.sharp ? 1 : 1.5;
  c.strokeRect(x + 0.5, y - 6.5, w - 1, 13);
  type(b, word, x + 5, y + 0.5, { size: o.size ?? 8.5, hue: o.wordInk ?? o.edge, share: 0.55 });
  return w;
};
export const ring = (b: Brush, x: number, y: number, r: number, hue: string, a = 0.9, width = 1.5) => {
  const { c } = b;
  c.strokeStyle = rgb(hue, a);
  c.lineWidth = width;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
};
/** a run of words as the broken screen keeps them: blocks the length of words, a line of text gone to marks */
export const prose = (b: Brush, x: number, y: number, w: number, o: { hue?: string; a?: number; h?: number; share?: number; seed: number }) => {
  const r = rng(o.seed);
  const { c } = b;
  c.fillStyle = rgb(o.hue ?? b.ink.secondary, o.a ?? 0.6);
  for (let at = x; at < x + w; ) {
    const len = Math.min(x + w - at, 8 + r() * 30);
    if (b.sharp ? true : b.r() < (o.share ?? 0.5)) c.fillRect(at, y - (o.h ?? 2) / 2, len, o.h ?? 2);
    at += len + 4 + r() * 3;
  }
};

/* ---- THE WALK --------------------------------------------------------------------------------------------------- */

export interface Step {
  val: number;
  vol: number;
  jit: number;
}
export type Walk = ReturnType<typeof walk>;
/** THE WALK: a value with momentum, leaning back to where it began, a step every `step` ms and `gap` px apart, its newest
    step at the band's right end; its height eased after its range so it never jumps */
export const walk = (seed: number, o: { step?: number; gap?: number; lean?: number; kick?: number; spike?: number; drift?: number } = {}) => {
  const STEP = o.step ?? 300;
  const GAP = o.gap ?? 3;
  const rand = rng(seed);
  let p = 0;
  let v = 0;
  const next = (): Step => {
    v = v * 0.86 + (rand() - 0.5) * (o.kick ?? 0.9) - p * (o.lean ?? 0.003) + (o.drift ?? 0);
    p += v;
    const spike = rand() < (o.spike ?? 0.08) ? 0.55 + rand() * 0.45 : 0;
    return { val: p, vol: Math.max(0.12, Math.min(1, 0.22 + rand() * 0.5 + spike)), jit: (rand() - 0.5) * 2 };
  };
  const steps: Step[] = [];
  let t0 = 0;
  let pending = next();
  let x0 = 0;
  let x1 = 0;
  let top = 0;
  let bot = 0;
  let rlo = 0;
  let rhi = 1;
  const cap = () => Math.ceil((x1 - x0) / GAP) + 6;
  const bounds = () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of steps) {
      if (s.val < lo) lo = s.val;
      if (s.val > hi) hi = s.val;
    }
    const pad = (hi - lo) * 0.12 + 0.5;
    return [lo - pad, hi + pad];
  };
  const head = () => x1 - 2;
  const valAt = (t: number) => {
    const n = steps.length;
    const f = (t - t0) / STEP;
    const j = Math.max(0, Math.min(n - 1, Math.floor(f)));
    const a = steps[j].val;
    const b = j + 1 < n ? steps[j + 1].val : pending.val;
    return a + (b - a) * ease(Math.max(0, Math.min(1, f - j)));
  };
  const yOf = (val: number) => top + (1 - (val - rlo) / Math.max(1e-6, rhi - rlo)) * (bot - top);
  const xOf = (i: number, t: number) => head() - ((t - (t0 + i * STEP)) / STEP) * GAP;
  const ago = (x: number) => ((head() - x) / GAP) * STEP;
  const w = {
    STEP,
    GAP,
    steps,
    /** the band it runs in; the first time, the line already runs the band's width, its last step just taken */
    place(nx0: number, nx1: number, ntop: number, nbot: number, t: number) {
      x0 = nx0;
      x1 = nx1;
      top = ntop;
      bot = nbot;
      if (!steps.length) {
        while (steps.length < cap()) steps.push(next());
        /* the step to come follows the last one taken (it was made before them, and the line fell back to where it began
           the moment it came due — the sharp V the first piece carried across its pane) */
        pending = next();
        t0 = t - (steps.length - 1) * STEP;
        [rlo, rhi] = bounds();
      } else
        while (steps.length < cap()) {
          steps.unshift({ val: steps[0].val, vol: 0.3, jit: 0 });
          t0 -= STEP;
        }
    },
    /** the steps that came due by t, and the range eased after them */
    tick(t: number, dt: number) {
      while (t - (t0 + (steps.length - 1) * STEP) >= STEP) {
        steps.push(pending);
        pending = next();
      }
      while (steps.length > cap()) {
        steps.shift();
        t0 += STEP;
      }
      if (dt > 0) {
        const [lo, hi] = bounds();
        const k = 1 - Math.exp(-dt / 900);
        rlo += (lo - rlo) * k;
        rhi += (hi - rhi) * k;
      }
    },
    head,
    xOf,
    yOf,
    valAt,
    ago,
    headY: (t: number) => yOf(valAt(t)),
    /** the line's height where it stands at x */
    yAt: (x: number, t: number) => yOf(valAt(t - ago(x))),
    /** the first step on the band */
    first: (t: number) => Math.max(0, Math.floor((t - t0) / STEP - (head() - x0) / GAP) - 1),
    /** the value's share of its range at t (0 at the foot, 1 at the top) */
    share: (t: number) => (valAt(t) - rlo) / Math.max(1e-6, rhi - rlo),
    /** the path from the band's left to the head (no stroke), rough by `rough` px */
    trace(c: CanvasRenderingContext2D, t: number, dx: number, dy: number, rough: number) {
      c.beginPath();
      let started = false;
      for (let i = w.first(t); i < steps.length; i++) {
        const x = xOf(i, t);
        if (x < x0) continue;
        const y = yOf(steps[i].val) + steps[i].jit * rough;
        if (started) c.lineTo(x + dx, y + dy);
        else {
          c.moveTo(x + dx, y + dy);
          started = true;
        }
      }
      c.lineTo(head() + dx, yOf(valAt(t)) + dy);
    },
  };
  return w;
};

/** a small line that walks inside a box (a card's sparkline, a curve's spot) — rough when broken, clean when sharp */
export const sparkline = (seed: number, o: { step?: number; gap?: number; kick?: number } = {}) => {
  const wk = walk(seed, { step: o.step ?? 700, gap: o.gap ?? 4, kick: o.kick ?? 0.9, lean: 0.01 });
  let at: Box = box(0, 0, 0, 0);
  return {
    wk,
    place(b: Box, t: number) {
      at = b;
      wk.place(b.x0, b.x1, b.y0, b.y1, t);
    },
    box: () => at,
    tick: (f: Frame) => wk.tick(f.t, f.dt),
    /** up since its first step on the band? */
    up: (t: number) => wk.valAt(t) >= wk.steps[wk.first(t)]?.val,
    draw(c: CanvasRenderingContext2D, t: number, style: string, width: number, rough: number) {
      c.lineJoin = 'round';
      c.lineWidth = width;
      c.strokeStyle = style;
      wk.trace(c, t, 0, 0, rough);
      c.stroke();
    },
  };
};

/* ---- THE ARROW -------------------------------------------------------------------------------------------------- */

/** the arrow — the photograph's own pointer */
export const ARROW: [number, number][] = [
  [0, 0],
  [0, 15.5],
  [3.7, 12],
  [6.3, 17.8],
  [8.9, 16.7],
  [6.3, 11.1],
  [11.2, 11.1],
];
