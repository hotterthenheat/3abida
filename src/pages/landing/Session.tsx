/*
==================================================
  SLAYER TERMINAL - ONE SESSION, AS THE TERMINAL SAW IT
  (pages/landing/Session.tsx)

  THE LANDING'S DEMONSTRATION (2026-10-03 — the owner's
  brief for the rebuilt landing: "Take one real
  historical market situation … Before … Positioning
  changes … Key level changes … Compass updates … Price
  interacts with the level … The point is not to claim
  'Slayer predicted the move.' The point is: 'Look at
  what the terminal was able to show.'").

  WHAT IT IS: one run of the terminal's own Pulse desk,
  a picture at a time (scripts/make-landing-session.mjs):
  the desk opened at 09:31 on its day and run forward,
  and at every step a reading — the price, the walls,
  the flip, Compass's top cards — and a picture of the
  desk as it stood. Five of the readings are the beats,
  and every word of a beat is read off its picture
  (session.json keeps the readings beside the frames).
  No date is printed: the terminal runs on its own data
  until a feed is connected, and the beats take a day's
  date when they are taken from a real one.

  THE SCROLL IS THE CLOCK (a desk): the window stands
  while the beats pass beside it, and between two beats
  it plays the session forward through every picture in
  between — the reader's scroll is the playhead. At a
  beat it holds: the beat's own full-size picture over
  the run's, and a hairline round what changed. On a
  phone each beat carries its own picture, framed on
  what changed. Where less motion is asked for, a beat
  changes the picture at once.

  THE COST: the run's pictures are fetched only when the
  reader comes near (the beats' first), drawn on one
  canvas only when the step on screen changes, and the
  scroll is read only while the section is on screen.

  THE STORY (a desk, 2026-10-03 — "the same picture
  three times"): the desk the scattered parts gather
  into IS this window (Scatter.tsx `story`): the window
  stands hidden while they come together, comes in as
  they land on its own first picture, and what the
  session says first (`story.lead`) stands beside it
  before the beats come up. A phone, or less motion,
  has the head and the beats as before.
==================================================
*/

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Theme } from '../../theme/theme';
import ProductGlyph from '../../brand/ProductGlyph';
import { useIsBelowLg } from '../../components/ui/useMediaQuery';
import { Prompt } from './TerminalWindow';
import SESSION from './session.json';

type Box = [number, number, number, number];
interface Beat {
  step: number;
  time: string;
  boxes: Box[];
}
const DATA = SESSION as unknown as { w: number; h: number; frames: number; times: string[]; beats: Beat[] };
const BEATS = DATA.beats;

/* THE BEATS' WORDS — each read off its picture (session.json `readings`): a new run of the session takes new words */
const WORDS: { title: string; text: string }[] = [
  { title: 'Before', text: 'SPY is at 470.29. Overhead sits the heaviest call positioning on the board: the call wall at 475.' },
  { title: 'Positioning shifts', text: 'SPY climbs to 474.04, and the book turns under it: the heaviest strike swings from the 475 calls to the 470 puts.' },
  { title: 'Compass updates', text: 'At 474.82, a breath under the wall, the SPY 475 call becomes Compass’s top pick.' },
  { title: 'The level moves', text: 'SPY trades through 475, and the call wall steps up to 477.' },
  { title: 'Price meets the level', text: '475 turns from ceiling to floor. The put wall moves up to it at 12:22, and price keeps coming back to it.' },
];

const frameSrc = (theme: Theme, i: number) => `/landing/session/${theme}/f${String(i).padStart(3, '0')}.webp`;
export const beatSrc = (theme: Theme, k: number) => `/landing/session/${theme}/beat-${k + 1}.webp`;

/** how much of the way from one beat to the next the picture holds on the first before it plays on — the while its words
    are read, from the middle of the screen to near its top; the session plays as they go and the next come up */
const HOLD = 0.55;
/** where on the screen a beat's first line is when it is reached: a little under the middle */
const AT = 0.62;
const ease = (t: number) => t * t * (3 - 2 * t);
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
/** the window's chrome: its bar and its two borders */
const CHROME = 42;

/** A HAIRLINE ROUND WHAT CHANGED, laid in the picture's own measure (session.json boxes are CSS px of the 1440 × 1000 desk) */
const Marks = ({ boxes, on, frame }: { boxes: Box[]; on: boolean; frame?: Box }) => {
  const [fx, fy, fw, fh] = frame ?? [0, 0, DATA.w, DATA.h];
  return (
    <>
      {boxes.map((b, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="absolute rounded-[4px] border-[1.5px] border-silver shadow-[0_0_0_1px_rgb(var(--canvas)/0.55)] transition-opacity duration-200 motion-reduce:transition-none pointer-events-none"
          style={{ left: pct(b[0] - fx, fw), top: pct(b[1] - fy, fh), width: pct(b[2], fw), height: pct(b[3], fh), opacity: on ? 1 : 0 }}
          data-session-mark
        />
      ))}
    </>
  );
};

/** THE WINDOW'S CHROME, as TerminalWindow draws it: the terminal's glyph, the prompt that opened the desk (typed as the
    window comes in — in the story, once the parts have landed), and — at its right — the moment of the session on screen */
const Bar = ({ time, typed = true }: { time: string; typed?: boolean }) => (
  <div className="relative shrink-0 h-10 pl-3.5 pr-4 flex items-center gap-2.5 border-b border-borderSubtle bg-panel">
    <ProductGlyph name="terminal" size={16} bare className="shrink-0" />
    {typed && <Prompt path="/pulse" />}
    <span className="ml-auto pl-4 font-code text-[11.5px] tnum text-textMuted whitespace-nowrap" data-session-time>
      SPY · {time}
    </span>
  </div>
);

/** ON A PHONE: the beat's own picture, framed on what changed (with room round it), in the window's chrome */
const framing = (boxes: Box[]): Box => {
  const x0 = Math.min(...boxes.map(b => b[0])) - 48;
  const y0 = Math.min(...boxes.map(b => b[1])) - 48;
  const x1 = Math.max(...boxes.map(b => b[0] + b[2])) + 48;
  const y1 = Math.max(...boxes.map(b => b[1] + b[3])) + 48;
  let w = x1 - x0;
  let h = y1 - y0;
  /* a frame a little wider than tall, as a phone's column likes */
  const want = 1.25;
  if (w / h > want) h = w / want;
  else w = h * want;
  w = Math.min(w, DATA.w);
  h = Math.min(h, DATA.h);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const x = Math.max(0, Math.min(DATA.w - w, cx - w / 2));
  const y = Math.max(0, Math.min(DATA.h - h, cy - h / 2));
  return [x, y, w, h];
};
const BeatPicture = ({ theme, k }: { theme: Theme; k: number }) => {
  const beat = BEATS[k];
  const f = framing(beat.boxes);
  return (
    <div className="mt-6 overflow-hidden rounded-[10px] border border-borderMuted bg-canvas" data-theme={theme}>
      <Bar time={beat.time} />
      <div className="relative overflow-hidden" style={{ aspectRatio: `${f[2]} / ${f[3]}` }}>
        <img
          src={beatSrc(theme, k)}
          alt={`The Pulse desk at ${beat.time}: ${WORDS[k].title.toLowerCase()}`}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute max-w-none select-none"
          style={{ width: pct(DATA.w, f[2]), left: `-${pct(f[0], f[2])}`, top: `-${pct(f[1], f[3])}` }}
        />
        <Marks boxes={beat.boxes} on frame={f} />
      </div>
    </div>
  );
};

/** THE STAGE (a desk): the run on one canvas, the beat's full-size still over it while it holds, the marks over both */
interface View {
  /** the run's step on screen */
  k: number;
  /** the beat being read */
  lit: number;
  /** holding on that beat's own picture */
  hold: boolean;
  /** not yet at the first beat: the picture stands, no marks yet (the story's parts have only just landed on it) */
  pre: boolean;
}

/** THE STORY'S HOLD ON THIS WINDOW (a desk): the parts gather into it (Scatter.tsx), so it hands them its window and its
    picture, and stands its first words beside it */
export interface Story {
  /** the window, standing on the right: hidden until the parts have landed */
  stage: MutableRefObject<HTMLDivElement | null>;
  /** its picture, where the parts come home */
  screen: MutableRefObject<HTMLDivElement | null>;
  /** what the session says first, standing beside the window: in after the window */
  intro: MutableRefObject<HTMLDivElement | null>;
  /** the parts have landed: the bar types the prompt */
  shown: boolean;
  /** the words beside the window, before the beats */
  lead: ReactNode;
}

/** the scroll the session's first words stand beside the window — the parts' run and a breath after it (svh); the
    words stand from a little above the screen's middle (PROLOGUE_AT) until their stretch is spent */
export const PROLOGUE = 140;
const PROLOGUE_AT = '24svh';

const Session = ({ theme, story }: { theme: Theme; story?: Story }) => {
  const small = useIsBelowLg();
  /* in the story (a desk): the window and the first words are the scatter's to bring in */
  const told = !!story && !small;
  const calm = useReducedMotion();
  const wrap = useRef<HTMLDivElement | null>(null);
  const beatEls = useRef<(HTMLLIElement | null)[]>([]);
  const screen = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState<View>({ k: BEATS[0].step, lit: 0, hold: true, pre: true });
  const viewNow = useRef(view);
  viewNow.current = view;

  /* ---- the pictures: fetched once the reader comes near, the beats' steps first ---- */
  const [near, setNear] = useState(false);
  const list = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    /* in the story the session starts right under the hero, so it is near from the first moment — it waits instead for
       its beats to come within a screen (the parts' run is ahead of them), and for the page's own first things to be in:
       its ninety pictures went out with the hero's and held it back */
    const el = told ? list.current : wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setNear(true);
    let io: IntersectionObserver | null = null;
    const watch = () => {
      io = new IntersectionObserver(
        ([e]) => {
          if (!e.isIntersecting) return;
          setNear(true);
          io?.disconnect();
        },
        { rootMargin: told ? '100% 0px' : '120% 0px' }
      );
      io.observe(el);
    };
    if (!told || document.readyState === 'complete') watch();
    else window.addEventListener('load', watch, { once: true });
    return () => {
      window.removeEventListener('load', watch);
      io?.disconnect();
    };
  }, [told]);
  /* …and the parts landing on the window bring its pictures in whatever the page is still loading (the first is the
     parts' own picture, in already) */
  const shown = told && story.shown;
  useEffect(() => {
    if (shown) setNear(true);
  }, [shown]);
  const imgs = useRef<(HTMLImageElement | null)[]>([]);
  const drawn = useRef(-1);
  const draw = useCallback((k: number, force = false) => {
    const c = canvas.current;
    if (!c) return;
    /* the nearest picture already in, to the step asked for */
    let at = -1;
    for (let d = 0; d < DATA.frames; d++) {
      if (imgs.current[k - d]) {
        at = k - d;
        break;
      }
      if (imgs.current[k + d]) {
        at = k + d;
        break;
      }
    }
    if (at < 0 || (at === drawn.current && !force)) return;
    const g = c.getContext('2d');
    if (!g) return;
    g.drawImage(imgs.current[at]!, 0, 0, c.width, c.height);
    drawn.current = at;
  }, []);
  useEffect(() => {
    if (!near || small || calm) return;
    let alive = true;
    imgs.current = new Array(DATA.frames).fill(null);
    drawn.current = -1;
    const order = [...new Set([...BEATS.map(b => b.step), ...Array.from({ length: DATA.frames }, (_, i) => i)])];
    let next = 0;
    const pull = () => {
      if (!alive || next >= order.length) return;
      const i = order[next++];
      const img = new Image();
      img.decoding = 'async';
      img.src = frameSrc(theme, i);
      img
        .decode()
        .then(() => {
          if (!alive) return;
          imgs.current[i] = img;
          /* a picture nearer the step on screen than the one drawn goes up at once */
          const k = viewNow.current.k;
          if (drawn.current < 0 || Math.abs(i - k) < Math.abs(drawn.current - k)) draw(k);
        })
        .catch(() => {})
        .finally(pull);
    };
    for (let n = 0; n < 6; n++) pull();
    /* the beats' own full-size pictures, ahead of being held on */
    BEATS.forEach((_, k) => (new Image().src = beatSrc(theme, k)));
    return () => {
      alive = false;
    };
  }, [near, small, calm, theme, draw]);

  /* the canvas is as sharp as the screen it is on */
  useLayoutEffect(() => {
    const el = screen.current;
    const c = canvas.current;
    if (!el || !c) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      draw(viewNow.current.k, true);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [small, calm, draw]);

  /* ---- the scroll is the playhead ---- */
  useEffect(() => {
    if (small) return;
    const el = wrap.current;
    if (!el) return;
    let anchors: number[] = [];
    const measure = () => {
      const vh = window.innerHeight;
      /* a beat is reached when its first line comes up to a little under the middle of the screen */
      anchors = beatEls.current.map(b => {
        const at = b?.querySelector('[data-session-anchor]') ?? b;
        return at ? at.getBoundingClientRect().top + window.scrollY - vh * AT : 0;
      });
    };
    let raf = 0;
    const place = () => {
      raf = 0;
      if (!anchors.length) measure();
      const y = window.scrollY;
      const n = anchors.length;
      let i = 0;
      while (i < n - 1 && y >= anchors[i + 1]) i++;
      const t = y < anchors[0] || i === n - 1 ? 0 : Math.min(1, (y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]));
      const from = BEATS[i].step;
      const to = i < n - 1 ? BEATS[i + 1].step : from;
      const k = calm ? from : Math.round(from + (to - from) * (t <= HOLD ? 0 : ease((t - HOLD) / (1 - HOLD))));
      const hold = t <= HOLD;
      const pre = y < anchors[0];
      const was = viewNow.current;
      if (was.k !== k || was.lit !== i || was.hold !== hold || was.pre !== pre) setView({ k, lit: i, hold, pre });
      if (!calm) draw(k);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    let listening = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !listening) {
        listening = true;
        measure();
        window.addEventListener('scroll', onScroll, { passive: true });
        place();
      } else if (!e.isIntersecting && listening) {
        listening = false;
        window.removeEventListener('scroll', onScroll);
      }
    });
    io.observe(el);
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    window.addEventListener('resize', onResize);
    return () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [small, calm, draw]);

  const lit = view.lit;
  /* the hairlines go up once the first beat is reached — in the story the parts have only just landed on its picture */
  const marked = (view.hold && !view.pre) || !!calm;
  return (
    <div ref={wrap} className="lg:grid lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-x-10 xl:gap-x-12" data-session>
      <div className="lg:pb-[14svh]">
        {told && (
          /* THE FIRST WORDS, beside the window: they stand from a little above the middle of the screen while the parts come
             together and a breath after (hidden until the window is in — Scatter.tsx), then go up the page ahead of the beats */
          <div data-session-prologue>
            <div ref={story.intro} className="sticky" style={{ top: PROLOGUE_AT, opacity: 0 }}>
              {story.lead}
            </div>
            <div aria-hidden="true" style={{ height: `${PROLOGUE}svh` }} />
          </div>
        )}
        <ol ref={list} aria-label="Five moments from the session">
          {BEATS.map((b, i) => {
            const on = small || i === lit;
            return (
              <li
                key={b.step}
                ref={el => {
                  beatEls.current[i] = el;
                }}
                className="py-9 border-t border-borderSubtle first:border-t-0 lg:border-t-0 lg:py-0 lg:min-h-[52svh] lg:pt-[10svh]"
                data-session-beat={i}
                data-on={on || undefined}
              >
                <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-textMuted" data-session-anchor>
                  <span className={`tnum transition-colors duration-300 ${on ? 'text-textPrimary' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="w-6 h-px bg-borderMuted" aria-hidden="true" />
                  <span className="tnum">{b.time}</span>
                </p>
                <h3 className={`mt-4 text-[26px] sm:text-[28px] xl:text-[30px] font-light leading-[1.05] tracking-[-0.03em] transition-colors duration-300 ${on ? 'text-textPrimary' : 'text-textMuted'}`}>
                  {WORDS[i].title}
                </h3>
                <p className={`mt-3 max-w-[34ch] text-[15.5px] leading-[1.55] transition-colors duration-300 ${on ? 'text-textSecondary' : 'text-textMuted'}`}>{WORDS[i].text}</p>
                {small && <BeatPicture theme={theme} k={i} />}
              </li>
            );
          })}
        </ol>
        {/* said once, under the last beat */}
        <p className="mt-2 lg:mt-10 max-w-[34ch] text-[13px] leading-relaxed text-textMuted" data-session-note>
          Read off the terminal at each moment, nothing added after. It shows what is there; it doesn’t predict what comes next.
        </p>
      </div>
      {!small && (
        <div
          ref={told ? story.stage : undefined}
          className="sticky top-[96px] self-start h-[calc(100svh-132px)] max-h-[860px] flex justify-start"
          style={told ? { opacity: 0 } : undefined}
          data-session-stage
        >
          <div
            className="self-start overflow-hidden rounded-[10px] border border-borderMuted bg-canvas flex flex-col"
            style={{ width: `min(100%, calc((min(100svh - 132px, 860px) - ${CHROME}px) * ${DATA.w / DATA.h} + 2px))` }}
            data-theme={theme}
          >
            <Bar time={DATA.times[view.k] ?? BEATS[lit].time} typed={!told || story.shown} />
            <div
              ref={el => {
                screen.current = el;
                if (told) story.screen.current = el;
              }}
              className="relative overflow-hidden"
              style={{ aspectRatio: `${DATA.w} / ${DATA.h}` }}
            >
              {!calm && <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 w-full h-full" />}
              {/* the beat's own picture, full size, while the session holds on it (and, where less motion is asked for, always) */}
              {near &&
                BEATS.map((b, i) => (
                  <img
                    key={b.step}
                    src={beatSrc(theme, i)}
                    alt={i === lit ? `The Pulse desk at ${b.time}: ${WORDS[i].title.toLowerCase()}` : ''}
                    aria-hidden={i === lit ? undefined : true}
                    draggable={false}
                    decoding="async"
                    className="absolute inset-0 w-full h-full select-none transition-opacity duration-200 motion-reduce:transition-none"
                    style={{ opacity: i === lit && (view.hold || calm) ? 1 : 0 }}
                  />
                ))}
              <Marks boxes={BEATS[lit].boxes} on={marked} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Session;
