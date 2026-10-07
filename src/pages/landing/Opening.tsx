/*
==================================================
  SLAYER TERMINAL - THE OPENING
  (pages/landing/Opening.tsx)

  THE FIRST SCREEN IS WORDS (v5, 2026-10-05 — the owner: "we need to have a nice strong quote … we shouldn't show any
  panels when u first land it should just be informational that teases and ropes you in and as you scroll you know you
  have amazing motions and small glitchy effects very subtle"). The quote — "You can't trade what you can't see." — what
  lies scattered, in three plain lines, and the two doors. No picture: the terminal is what the scroll brings.

  THE SCROLL ANSWERS IT (a desk). The quote turns into its answer, "Trade what you can see.": "You can't" and the "'t"
  go, the words close up and the t stands up, and the line rises to stand over the screen. A silver line is drawn under
  it and opens into the terminal, the picture resolving out of a fine grain and taking its colour as it opens
  (pixels.ts — the landing's one glitch, made quiet). The terminal stands whole a moment, then goes to stand beside the
  session as its window (Session.tsx `story`): the same picture in the same place, so the hand-over has no seam, and the
  session's first words come in beside it.

  The stage stands still while the scroll plays it (sticky); nothing moves but with the scroll, and a run at rest is
  not drawn again. A phone and less motion have the first screen still and the terminal under it (Landing.tsx).
==================================================
*/

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Theme } from '../../theme/theme';
import { Bar, FIRST_TIME, beatSrc, type Story } from './Session';
import { inksAt, pictureIn, pieceOf, type Piece } from './pixels';
import { unit } from './scale';

/* ---- the words ----------------------------------------------------------------------------- */

/** THE QUOTE, word by word, and what each word becomes in the answer ("Trade what you can see.") — a word with no `to`
    goes. `tight`: no space before it; `br`: the first line ends after it. */
interface Word {
  id: string;
  text: string;
  to?: string;
  tight?: boolean;
  br?: boolean;
}
const WORDS: Word[] = [
  { id: 'you', text: 'You' },
  { id: 'cant', text: 'can’t' },
  { id: 'trade', text: 'trade', to: 'Trade', br: true },
  { id: 'what', text: 'what', to: 'what' },
  { id: 'you2', text: 'you', to: 'you' },
  { id: 'can', text: 'can', to: 'can' },
  { id: 'nt', text: '’t', tight: true },
  { id: 'see', text: 'see.', to: 'see.' },
];

/** THE QUOTE — the page's h1. Each word comes into focus as it rises, one after another (index.css .landing-word). With
    `answer`, it carries what the scroll turns it into: the capital T laid over the t, and the answer set out of sight, on
    the second line's place, for the words to be measured against. */
export const Quote = ({ answer = false, className = '' }: { answer?: boolean; className?: string }) => (
  <h1 className={`relative font-light tracking-[-0.05em] leading-[0.95] outline-none ${className}`} data-landing-quote>
    {WORDS.map((w, i) => (
      <Fragment key={w.id}>
        {i > 0 && !w.tight && ' '}
        <span data-word={w.id} className="relative inline-block">
          <span className="landing-word inline-block" style={{ '--w': i } as CSSProperties} data-word-ink>
            {w.text}
          </span>
          {answer && w.to && w.to !== w.text && (
            <span aria-hidden="true" className="absolute left-0 top-0" style={{ opacity: 0 }} data-word-to>
              {w.to}
            </span>
          )}
        </span>
        {w.br && <br />}
      </Fragment>
    ))}
    {answer && (
      /* (the line inside its own span: a flex box drops the spaces between its children) */
      <span aria-hidden="true" className="absolute inset-0 flex items-end justify-center invisible pointer-events-none" data-quote-answer>
        <span className="whitespace-nowrap">
          {WORDS.filter(w => w.to).map((w, i) => (
            <Fragment key={w.id}>
              {i > 0 && ' '}
              <span data-answer={w.id} className="inline-block">
                {w.to}
              </span>
            </Fragment>
          ))}
        </span>
      </span>
    )}
  </h1>
);

/** WHAT LIES SCATTERED — the line under the quote and the three things it means (no numbers on them since 2026-10-06 —
    the owner's directive: "remove 01/02/03 from the hero facts … neither is a sequence") */
const FACTS = ['Where the options positions sit', 'Where dealer hedging flips', 'What is trading right now'];
export const Tease = ({ className = '' }: { className?: string }) => (
  <div className={className} data-landing-tease>
    <p className="landing-rise [--rise-delay:420ms] text-[1.0625rem] sm:text-[1.1875rem] leading-[1.5] text-textSecondary [text-wrap:balance]">Most of what moves a price is public. It’s just scattered:</p>
    <ul className="mt-5 flex flex-col sm:flex-row sm:flex-wrap sm:justify-center items-center gap-x-8 gap-y-2.5 text-[0.9375rem] text-textPrimary">
      {FACTS.map((f, i) => (
        <li key={f} className="landing-rise" style={{ '--rise-delay': `${480 + i * 60}ms` } as CSSProperties}>
          {f}
        </li>
      ))}
    </ul>
  </div>
);

/* ---- the run ------------------------------------------------------------------------------- */

/** the overlay's height (svh): the run is this less the screen the stage stands on */
export const TRACK = 240;

/* THE RUN, in shares of it: the first scroll turns the quote and draws the line, the terminal is open within the first
   screen of scrolling, stands whole a while, then goes to stand beside the session */
const REST_OUT: [number, number] = [0, 0.08];
const MORPH: [number, number] = [0, 0.15];
const LIFT: [number, number] = [0.1, 0.22];
const LINE: [number, number] = [0.1, 0.22];
const OPEN: [number, number] = [0.2, 0.38];
const SHARP: [number, number] = [0.22, 0.42];
const HEAD_OUT: [number, number] = [0.5, 0.6];
const DOCK: [number, number] = [0.52, 0.8];
/** the session's window takes over, on the same picture in the same place */
const LANDED = 0.82;
const GONE: [number, number] = [0.86, 0.91];
/** …and stands alone a breath after: its camera may leave the whole desk for the first beat's level (Session.tsx), and
    comes back to it before this picture returns */
const LANDED_ALONE = 0.93;
const LEAD_IN: [number, number] = [0.84, 0.92];
/** where "See how it works" goes: the session's first words standing beside its window */
export const HOW_AT = 0.95;

/** the answer's top on the screen, under the floating bar, and the room between it and the terminal (the design's px —
    every size here is one of them times the landing's scale, scale.ts) */
const HEAD_TOP = 86;
const HEAD_GAP = 26;
/** the window's bar (Session.tsx's window): its height, and its hairlines */
const BAR = 40;
/** the picture's shape — the session's run is the desk at 1440 × 1000 */
const ASPECT = 1440 / 1000;

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const span = (p: number, [a, b]: [number, number]) => clamp((p - a) / (b - a));

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const mix = (a: Rect, b: Rect, t: number): Rect => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });

interface Props {
  theme: Theme;
  /** the session's window, its picture and its first words (Session.tsx) */
  story: Pick<Story, 'stage' | 'screen' | 'intro'>;
  /** the terminal is open and on its way to the session: the session's own pictures may come */
  onNear: () => void;
  /** this one's picture has gone and the session's window stands alone (true), or is coming back over it (false): the
      session's camera stands on the whole desk, as this picture does, until it has gone */
  onLanded?: (landed: boolean) => void;
  /** the two doors, under the words */
  doors: ReactNode;
}

const Opening = ({ theme, story, onNear, onLanded, doors }: Props) => {
  const wrap = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const quote = useRef<HTMLDivElement | null>(null);
  const rest = useRef<HTMLDivElement | null>(null);
  const cue = useRef<HTMLDivElement | null>(null);
  const pool = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const bar = useRef<HTMLDivElement | null>(null);
  const lineA = useRef<HTMLSpanElement | null>(null);
  const lineB = useRef<HTMLSpanElement | null>(null);
  /* the window's bar types its prompt once it is open */
  const [typed, setTyped] = useState(false);
  const nearNow = useRef(onNear);
  nearNow.current = onNear;
  const landedNow = useRef(onLanded);
  landedNow.current = onLanded;

  useEffect(() => {
    const el = wrap.current;
    const st = stage.current;
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    const q = quote.current?.querySelector<HTMLElement>('[data-landing-quote]');
    if (!el || !st || !c || !ctx || !q) return;
    let alive = true;
    let raf = 0;
    let listening = false;
    let img: HTMLImageElement | null = null;
    let piece: Piece | null = null;
    let cool: () => void = () => {};
    let vw = 0;
    let vh = 0;
    let dpr = 1;
    /** one of the design's pixels (scale.ts), and the window's bar and chrome at it (its hairlines stay one px) */
    let u = 1;
    let barH = BAR + 1;
    let chrome = BAR + 2;
    /** the terminal standing whole under the answer, and where it goes to stand: the session's window */
    let centre: Rect = { x: 0, y: 0, w: 0, h: 0 };
    let dock: Rect = { x: 0, y: 0, w: 0, h: 0 };
    /** the words: each one's way from the quote to the answer (px, the quote's own measure), and the line's lift */
    let moves = new Map<string, { el: HTMLElement; dx: number; dy: number; keep: boolean; to: HTMLElement | null; ink: HTMLElement | null }>();
    let lift = { tx: 0, ty: 0, k: 1 };
    let opened = false;
    let near = false;
    /** the run as last drawn: a run at rest is not drawn again */
    let last = -1;
    /** the session's window stands alone (this one's picture gone): its camera may leave the whole desk */
    let landed = false;

    const layout = () => {
      vw = st.clientWidth;
      vh = st.clientHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      u = unit();
      barH = BAR * u + 1;
      chrome = BAR * u + 2;
      c.width = Math.max(1, Math.round(vw * dpr));
      c.height = Math.max(1, Math.round(vh * dpr));
      const sb = st.getBoundingClientRect();

      /* THE WORDS, where the type sets them: every transform the run gave them let go of first */
      q.style.transform = '';
      const words = Array.from(q.querySelectorAll<HTMLElement>('[data-word]'));
      words.forEach(w => (w.style.transform = ''));
      const qb = q.getBoundingClientRect();
      const answers = new Map(Array.from(q.querySelectorAll<HTMLElement>('[data-answer]')).map(a => [a.dataset.answer!, a.getBoundingClientRect()]));
      moves = new Map(
        words.map(w => {
          const id = w.dataset.word!;
          const from = w.getBoundingClientRect();
          const to = answers.get(id);
          return [id, { el: w, dx: to ? to.left - from.left : 0, dy: to ? to.top - from.top : 0, keep: !!to, to: w.querySelector<HTMLElement>('[data-word-to]'), ink: w.querySelector<HTMLElement>('[data-word-ink]') }];
        })
      );
      /* the answer's line: its box in the quote's measure, the size it stands at over the terminal, and its way there */
      const boxes = [...answers.values()];
      const l = Math.min(...boxes.map(b => b.left)) - qb.left;
      const r = Math.max(...boxes.map(b => b.right)) - qb.left;
      const t = Math.min(...boxes.map(b => b.top)) - qb.top;
      const b = Math.max(...boxes.map(b => b.bottom)) - qb.top;
      const font = parseFloat(getComputedStyle(q).fontSize) || 100;
      const want = clamp(Math.min(vw * 0.046, vh * 0.074), 40 * u, 68 * u);
      const k = Math.min(want / font, (vw - 64 * u) / Math.max(1, r - l));
      const cx = (l + r) / 2;
      const cy = (t + b) / 2;
      q.style.transformOrigin = `${cx}px ${cy}px`;
      lift = { k, tx: vw / 2 - (qb.left - sb.left + cx), ty: HEAD_TOP * u + (k * (b - t)) / 2 - (qb.top - sb.top + cy) };

      /* THE TERMINAL, whole: under the answer, as large as the screen holds it at the picture's own shape */
      const top = (HEAD_TOP + HEAD_GAP) * u + k * (b - t);
      let h = vh - top - 28 * u;
      let w = 2 + (h - chrome) * ASPECT;
      const most = Math.min(vw - 64 * u, 1320 * u);
      if (w > most) {
        w = most;
        h = chrome + (w - 2) / ASPECT;
      }
      centre = { x: (vw - w) / 2, y: top, w, h };

      /* …and where it goes: the session's window, where it stands (sticky) while the run plays */
      const scr = story.screen.current;
      const win = scr?.parentElement;
      const stg = story.stage.current;
      if (win && stg) {
        const r2 = win.getBoundingClientRect();
        const s2 = stg.getBoundingClientRect();
        const stick = parseFloat(getComputedStyle(stg).top) || 96 * u;
        dock = { x: r2.left - sb.left, y: stick + (r2.top - s2.top), w: r2.width, h: r2.height };
      } else dock = centre;
      build();
      last = -1;
    };

    /* the picture, read at the size it stands whole, in the design's px — its grain the same on every screen (read again
       when that changes) */
    const build = () => {
      if (!img || !img.naturalWidth) return;
      piece = pieceOf(img, 0, 0, img.naturalWidth, img.naturalHeight, (centre.w - 2) / u, (centre.h - chrome) / u, inksAt(st));
      cool();
      cool = piece ? piece.warm() : () => {};
      last = -1;
    };

    /* the run: 0 as the stage pins (the top of the page), 1 as it lets go */
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
      const isLanded = p >= LANDED_ALONE;
      if (isLanded !== landed) {
        landed = isLanded;
        landedNow.current?.(isLanded);
      }

      /* THE WORDS: the doors and the three lines go first; the quote turns into its answer and rises over the screen */
      const out = span(p, REST_OUT);
      for (const r of [rest.current]) {
        if (!r) continue;
        r.style.opacity = String(1 - out);
        r.style.transform = out ? `translate3d(0, ${Math.round(-28 * u * out)}px, 0)` : '';
        r.style.visibility = out >= 1 ? 'hidden' : '';
      }
      if (cue.current) cue.current.style.opacity = String(1 - clamp(p / 0.03));
      if (pool.current) pool.current.style.opacity = String(1 - span(p, [0.3, 0.6]));
      /* the negations dissolve first; then "trade" slides along the emptied first line while the second closes its gap,
         and drops into its place at the head of it — no word crosses another */
      const m = span(p, MORPH);
      for (const w of moves.values()) {
        if (w.keep) {
          const turns = Math.abs(w.dy) > 1;
          const mx = ease(span(m, turns ? [0.28, 0.72] : [0.25, 0.75]));
          const my = turns ? ease(span(m, [0.68, 1])) : 0;
          w.el.style.transform = mx || my ? `translate3d(${w.dx * mx}px, ${w.dy * my}px, 0)` : '';
        } else {
          const d = ease(span(m, [0, 0.3]));
          w.el.style.opacity = String(1 - d);
          w.el.style.transform = d ? `translate3d(0, ${-14 * u * d}px, 0)` : '';
          w.el.style.filter = d > 0 && d < 1 ? `blur(${(6 * u * d).toFixed(1)}px)` : '';
        }
        /* the t stands up quickly, mid-slide, so the two never stand together long */
        if (w.to && w.ink) {
          const up = span(m, [0.48, 0.58]);
          w.to.style.opacity = String(up);
          w.ink.style.opacity = String(1 - up);
        }
      }
      const rise = ease(span(p, LIFT));
      const gone = span(p, HEAD_OUT);
      q.style.transform = rise || gone ? `translate3d(${lift.tx * rise}px, ${lift.ty * rise - 24 * u * gone}px, 0) scale(${lerp(1, lift.k, rise)})` : '';
      q.style.opacity = String(1 - gone);

      /* THE LINE, drawn from the middle out, then opening into the terminal */
      const l = ease(span(p, LINE));
      const o = ease(span(p, OPEN));
      const d = ease(span(p, DOCK));
      const box = mix(centre, dock, d);
      const fh = o < 1 ? lerp(2, box.h, o) : box.h;
      const fy = o < 1 ? box.y + box.h / 2 - fh / 2 : box.y;
      const out2 = span(p, GONE);
      const a = lineA.current;
      const b = lineB.current;
      if (a && b) {
        const lit = l > 0 && o < 1 ? 1 - clamp((o - 0.5) / 0.45) : 0;
        a.style.opacity = b.style.opacity = String(lit);
        if (lit) {
          a.style.width = b.style.width = `${box.w}px`;
          a.style.transform = `translate3d(${box.x}px, ${fy - 1}px, 0) scaleX(${o > 0 ? 1 : l})`;
          b.style.transform = `translate3d(${box.x}px, ${fy + fh - 1}px, 0) scaleX(${o > 0 ? 1 : l})`;
        }
      }
      const f = frame.current;
      if (f) {
        f.style.opacity = o > 0 ? String(1 - out2) : '0';
        if (o > 0) {
          f.style.transform = `translate3d(${box.x}px, ${fy}px, 0)`;
          f.style.width = `${box.w}px`;
          f.style.height = `${fh}px`;
        }
      }
      if (bar.current) bar.current.style.opacity = String(clamp((o - 0.25) / 0.35));
      const open = o >= 0.7;
      if (open !== opened) {
        opened = open;
        if (open) setTyped(true);
      }
      if (!near && p >= 0.4) {
        near = true;
        nearNow.current();
      }

      /* THE PICTURE, in the window as it opens: a fine grain without its colour, resolving as it opens */
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      c.style.opacity = String(1 - out2);
      if (piece && o > 0 && out2 < 1) {
        const sp = span(p, SHARP);
        const sharp = sp >= 1 ? 1 : 0.12 + 0.87 * Math.pow(sp, 1.2);
        ctx.save();
        ctx.beginPath();
        const clip = [(box.x + 1) * dpr, (fy + 1) * dpr, (box.w - 2) * dpr, Math.max(0, fh - 2) * dpr] as const;
        if (typeof ctx.roundRect === 'function') ctx.roundRect(...clip, 9 * u * dpr);
        else ctx.rect(...clip);
        ctx.clip();
        piece.draw(ctx, (box.x + 1) * dpr, (box.y + barH) * dpr, (box.w - 2) * dpr, (box.h - chrome) * dpr, sharp);
        ctx.restore();
      }

      /* THE HAND-OVER: the session's window comes in under this one, on the same picture in the same place; this one goes,
         and the session's first words come in beside it */
      const stg = story.stage.current;
      if (stg) {
        stg.style.opacity = String(clamp((p - LANDED) / 0.04));
        stg.style.visibility = p < LANDED ? 'hidden' : '';
      }
      const intro = story.intro.current;
      if (intro) {
        const t = span(p, LEAD_IN);
        intro.style.opacity = String(t);
        intro.style.visibility = t > 0 ? '' : 'hidden';
        intro.style.transform = t >= 1 ? '' : `translateY(${Math.round((1 - t) * 12 * u)}px)`;
      }
    };
    const ask = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    /* the picture waits for the page's own load (the words come first), or for the first scroll, whichever is sooner */
    const load = () => {
      if (img) return;
      const i = new Image();
      i.decoding = 'async';
      i.src = beatSrc(theme, 0);
      img = i;
      pictureIn(i).then(
        () => {
          if (!alive) return;
          build();
          ask();
        },
        () => {}
      );
    };
    const scrolled = () => {
      load();
      ask();
    };
    layout();
    draw();
    if (document.readyState === 'complete') load();
    else window.addEventListener('load', load, { once: true });

    /* the scroll heard only while the run is on screen, and read once more as it leaves, so a run scrolled past stands
       finished */
    const scope = el.closest('[data-story]') ?? el;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !listening) {
          listening = true;
          window.addEventListener('scroll', scrolled, { passive: true });
        } else if (!e.isIntersecting && listening) {
          listening = false;
          window.removeEventListener('scroll', scrolled);
        }
        ask();
      },
      { rootMargin: '50% 0px' }
    );
    io.observe(scope);
    let resized = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resized);
      resized = window.setTimeout(() => {
        if (!alive) return;
        layout();
        ask();
      }, 120);
    });
    ro.observe(st);
    if (story.screen.current) ro.observe(story.screen.current);
    /* the quote's own size moves with the fonts: measured again once they are in */
    void document.fonts?.ready.then(() => {
      if (!alive) return;
      layout();
      ask();
    });
    return () => {
      alive = false;
      cool();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('load', load);
      window.removeEventListener('scroll', scrolled);
      cancelAnimationFrame(raf);
      window.clearTimeout(resized);
    };
  }, [theme, story.stage, story.screen, story.intro]);

  return (
    <div ref={wrap} className="absolute inset-x-0 top-0 z-[1] pointer-events-none" style={{ height: `${TRACK}svh` }} data-opening>
      <div ref={stage} className="sticky top-0 h-[100svh] overflow-hidden">
        {/* the pool of light the words stand in — still, and gone as the terminal opens */}
        <div ref={pool} aria-hidden="true" className="landing-pool absolute inset-0" />
        <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 w-full h-full" />
        {/* THE WINDOW'S CHROME, drawn over the picture as it opens: its edge and its bar (the session's own, Session.tsx) */}
        <div ref={frame} aria-hidden="true" className="absolute left-0 top-0 overflow-hidden rounded-[0.625rem] border border-borderMuted will-change-transform" style={{ opacity: 0 }} data-opening-frame>
          <div ref={bar} style={{ opacity: 0 }}>
            <Bar time={FIRST_TIME} typed={typed} />
          </div>
        </div>
        {/* THE SILVER LINE — drawn, then parting as the terminal opens between its two halves */}
        <span ref={lineA} aria-hidden="true" className="foil-fill absolute left-0 top-0 h-[0.125rem] rounded-full origin-center will-change-transform" style={{ opacity: 0 }} />
        <span ref={lineB} aria-hidden="true" className="foil-fill absolute left-0 top-0 h-[0.125rem] rounded-full origin-center will-change-transform" style={{ opacity: 0 }} />

        {/* THE WORDS */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <div ref={quote} className="w-full">
            <Quote answer className="text-[clamp(4rem,min(8.4vw,14.5svh),8.5rem)] will-change-transform" />
          </div>
          <div ref={rest} className="mt-8 flex flex-col items-center will-change-transform">
            <Tease className="max-w-[54rem]" />
            {/* the doors are the one part of the stage a hand can press */}
            <div className="landing-rise [--rise-delay:700ms] mt-9 flex flex-wrap items-center justify-center gap-3 pointer-events-auto" data-landing-hero-doors>
              {doors}
            </div>
          </div>
        </div>
        {/* THE CUE: the page goes on — gone with the first scroll */}
        <div ref={cue} aria-hidden="true" className="landing-rise [--rise-delay:900ms] absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
          <span className="relative block w-px h-9 overflow-hidden bg-ink/[0.14]">
            <span className="landing-cue absolute inset-x-0 top-0 h-1/3 foil-fill" />
          </span>
        </div>
      </div>
    </div>
  );
};

export default Opening;
