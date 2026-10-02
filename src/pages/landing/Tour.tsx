/*
==================================================
  SLAYER TERMINAL - THE LANDING'S TOUR
  (pages/landing/Tour.tsx)

  ONE WINDOW, THE WHOLE WAY DOWN (TerminalWindow —
  stills of the real app from 2026-09-19, films of it
  being used since 2026-10-01). It stands beside every
  tool, and the words on the left CHOOSE ITS PICTURE —
  the tool whose words are on screen is the page it
  shows, and a row under a tool shows that page of it.
  Since the hero shows every desk at once (the wall,
  2026-10-01) the landing turns THE DOCK off: the
  window stands docked beside the words from its first
  frame. The dock below stays for a host that wants
  the window wide under its head first.

  THE DOCK is the one scroll-linked motion on the
  page. The window's place in the layout is always
  the docked one; under the hero its box is wider and
  reaches further left, and it eases home over about
  two thirds of a screen. Only the box changes per
  frame; the picture inside fills it. The docked box
  takes THE PICTURE'S OWN SHAPE (see `measure`), so
  on a desk a still is never cropped or stretched.
  The window's own bar is not scaled: the first cut
  scaled the whole window and on a laptop the bar
  came out half as big again (measured, 1.55×).
  Below `lg`, and where the visitor asked for less
  motion, there is no dock: the window pins under the
  bar and the words pass beneath it.

  THE TURN (ground.tsx) happens here, between two
  tools: a tall quiet stretch where the painted
  ground goes from one theme to the other and the
  window follows, crossfading to the same page's
  picture in the other theme. Its position is measured and handed
  to CSS as two variables — the gradient is painted
  once, never per frame.

  …AND THE TURN BACK. The page ends on the ground it
  opened on (Noah, 2026-09-19: "the light theme
  should begin but also end as a light theme and the
  dark theme should begin but end as a dark theme"),
  so after the last tool a second quiet stretch takes
  the ground home the same slow way, and the terminal
  in the window goes home with it. Two lines close
  the tour there, one on each ground.
==================================================
*/

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import TerminalWindow, { SHOT_ASPECT } from './TerminalWindow';
import { OnGround, useGround, type Ground } from './ground';
import { useIsBelowLg } from '../../components/ui/useMediaQuery';
import ProductGlyph from '../../brand/ProductGlyph';
import type { GlyphName } from '../../brand/paths';

export interface TourRow {
  title: string;
  says: string;
  /** A row with an address is a door: it opens that page in the window */
  path?: string;
}

export interface TourStep {
  id: string;
  /** "01" for a tool; none for the turn */
  code?: string;
  /** The room's glyph — its head wears it, as a product's page head does in the terminal (brand rules) */
  glyph?: GlyphName;
  /** The kind of tool, in a word or two */
  kind: string;
  name: string;
  lead: string;
  /** THE LEAD BY THE GROUND THE WORDS STAND ON (2026-09-22, Noah: "shouldn't the wording be 'Dark mode too' if the user
      is coming from a light mode") — the themes room stands on the ground the page turned INTO, so it names that one */
  leadFor?: Record<Ground, string>;
  rest: string;
  /** The page the window shows while this step is on screen */
  path: string;
  rows: TourRow[];
  /** THE TURN: this step opens with the stretch where the ground changes */
  turn?: boolean;
  /** …and what the stretch says at each end of it — one line on the ground it names */
  turnSays?: Record<Ground, string>;
}

interface Props {
  /** The hero's words — they share the tour's ground so the light behind the window has no seam */
  head: ReactNode;
  steps: TourStep[];
  /** The page the window opens on, before any tool's words are on screen */
  first: string;
  onOpen: (path: string) => void;
  /** The ground under the floating bar changed */
  onBarGround: (g: Ground) => void;
  /** THE TURN BACK's two lines: the first stands on the far ground, the second on the ground the page opened on */
  endSays: [string, string];
  /** THE DOCK: the window starts wide under the hero and glides to the right. Off when the hero shows the desks itself
      (Landing.tsx, the wall, 2026-10-01) — the window then stands docked from its first frame. */
  dock?: boolean;
}

/** Where the docked window's top sits, under the floating bar */
const PIN_TOP = 88;
const PIN_TOP_SMALL = 68;
/** The gutter the docked window keeps from the viewport's right edge */
const EDGE = 24;
/** How much scrolling the dock takes, in screens */
const DOCK_SCREENS = 0.7;
/** The window's own chrome, which keeps its size while the terminal scales: the bar and the two borders */
const CHROME = 42;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const Tour = ({ head, steps, first, onOpen, onBarGround, endSays, dock = true }: Props) => {
  const { a, b } = useGround();
  const small = useIsBelowLg();
  const calm = useReducedMotion();
  const dockable = dock && !small && !calm;

  const wrap = useRef<HTMLDivElement | null>(null);
  const grid = useRef<HTMLDivElement | null>(null);
  const cell = useRef<HTMLDivElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const band = useRef<HTMLDivElement | null>(null);
  const bandBack = useRef<HTMLDivElement | null>(null);
  const stepEls = useRef(new Map<string, HTMLElement>());

  const [active, setActive] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [turned, setTurned] = useState(false);
  const [lead, setLead] = useState(0);

  const geo = useRef({ s0: 0, d: 1, w0: 0, w1: 0, h1: 0, r0: 0, bandMid: Number.POSITIVE_INFINITY, backMid: Number.POSITIVE_INFINITY });
  const state = useRef({ turned: false, bar: false });

  const reveal = useMotionValue(dockable ? 0 : 1);
  const { scrollY } = useScroll();

  const place = useCallback(
    (y: number) => {
      const g = geo.current;
      const raw = dockable ? clamp01((y - g.s0) / g.d) : 1;
      const e = raw * raw * (3 - 2 * raw);
      const b0 = box.current;
      if (b0) {
        if (dockable && g.w1 > 0) {
          const w = g.w1 + (g.w0 - g.w1) * (1 - e);
          const k = (w - 2) / (g.w1 - 2);
          b0.style.width = `${w}px`;
          b0.style.height = `${CHROME + k * (g.h1 - CHROME)}px`;
          b0.style.right = `${g.r0 * (1 - e)}px`;
          b0.style.setProperty('--win-k', String(k));
          /* while it moves the terminal keeps one raster and is scaled by the compositor; at rest it is drawn crisp */
          if (raw > 0 && raw < 1) b0.dataset.moving = '1';
          else delete b0.dataset.moving;
        } else {
          b0.style.width = b0.style.height = b0.style.right = '';
          b0.style.removeProperty('--win-k');
          delete b0.dataset.moving;
        }
      }
      reveal.set(dockable ? clamp01((raw - 0.5) / 0.4) : 1);
      const vh = window.innerHeight;
      /* on the far ground between the two turns; home before the first and after the second */
      const line = y + vh * 0.55;
      const t = line > g.bandMid && line < g.backMid;
      if (t !== state.current.turned) {
        state.current.turned = t;
        setTurned(t);
      }
      const bar = y + 44 > g.bandMid && y + 44 < g.backMid;
      if (bar !== state.current.bar) {
        state.current.bar = bar;
        onBarGround(bar ? b : a);
      }
    },
    [dockable, reveal, onBarGround, a, b]
  );

  useMotionValueEvent(scrollY, 'change', place);

  /* the visitor flipped the theme: both ends of the journey changed, so say again which one the bar is over */
  useEffect(() => {
    onBarGround(state.current.bar ? b : a);
  }, [a, b, onBarGround]);

  /* THE GEOMETRY, measured — never typed. Runs when the page's width or the tour's height changes. */
  const measure = useCallback(() => {
    const w = wrap.current;
    const g = grid.current;
    const c = cell.current;
    const bd = band.current;
    if (!w || !g || !c || !bd) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const y = window.scrollY;
    const gr = g.getBoundingClientRect();
    const cs = getComputedStyle(g);
    const heroLeft = gr.left + parseFloat(cs.paddingLeft);
    const heroRight = gr.right - parseFloat(cs.paddingRight);
    /* on a desk the docked window runs past the column to the viewport's edge */
    c.style.marginRight = small ? '0px' : `${-Math.max(0, vw - EDGE - heroRight)}px`;
    const cr = c.getBoundingClientRect();
    const d = vh * DOCK_SCREENS;
    /* THE DOCKED WINDOW TAKES THE PICTURE'S SHAPE (2026-09-19: the window shows stills now, and a still has one shape):
       as wide as the cell, its screen SHOT_ASPECT — and where that would be taller than the cell, as tall as the cell
       and narrower, kept against the right edge. A picture is never cropped or stretched on a desk. */
    let w1 = cr.width;
    let h1 = CHROME + (w1 - 2) / SHOT_ASPECT;
    if (h1 > cr.height) {
      h1 = cr.height;
      w1 = 2 + (h1 - CHROME) * SHOT_ASPECT;
    }
    /* the words of the first tool arrive as the window comes home */
    setLead(dockable ? Math.round(vh * (0.4 + DOCK_SCREENS) - PIN_TOP) : 0);

    /* the turn is painted over exactly the quiet stretch: its first line stands on the ground it opens on, its last on the other */
    const wTop = w.getBoundingClientRect().top;
    const br = bd.getBoundingClientRect();
    const top = br.top - wTop;
    const end = br.bottom - wTop;
    w.style.setProperty('--band-top', `${Math.round(top)}px`);
    w.style.setProperty('--band-h', `${Math.max(1, Math.round(end - top))}px`);
    /* …and the turn back, the same way */
    const bk = bandBack.current?.getBoundingClientRect();
    const backTop = bk ? bk.top - wTop : 0;
    const backEnd = bk ? bk.bottom - wTop : 0;
    if (bk) {
      w.style.setProperty('--back-top', `${Math.round(backTop)}px`);
      w.style.setProperty('--back-h', `${Math.max(1, Math.round(backEnd - backTop))}px`);
    }

    geo.current = {
      s0: gr.top + y - PIN_TOP,
      d,
      w0: heroRight - heroLeft,
      w1,
      h1,
      r0: cr.right - heroRight,
      bandMid: wTop + y + top + (end - top) * 0.5,
      backMid: bk ? wTop + y + backTop + (backEnd - backTop) * 0.5 : Number.POSITIVE_INFINITY,
    };
    place(y);
  }, [small, dockable, place]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, lead]);

  /* WHOSE WORDS ARE ON SCREEN: the step crossing one line — half way down a desk, lower on a phone,
     where the window holds the top half. One observer; it fires on a crossing, never on scroll. */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const line = small ? 78 : 50;
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.tourStep ?? null;
          if (e.isIntersecting) setActive(id);
          else if (id === steps[0].id && e.boundingClientRect.top > 0) setActive(cur => (cur === id ? null : cur));
        }
      },
      { rootMargin: `-${line}% 0px -${100 - line - 0.5}% 0px`, threshold: 0 }
    );
    for (const el of stepEls.current.values()) io.observe(el);
    return () => io.disconnect();
  }, [small, steps]);

  const step = steps.find(s => s.id === active);
  const path = step ? picked[step.id] ?? step.path : first;
  const turnAt = steps.findIndex(s => s.turn);

  return (
    <div ref={wrap} className="relative isolate pb-56" data-tour data-tour-active={active ?? 'hero'} data-tour-turned={turned || undefined}>
      {/* `isolate`: the window's layer and its long shadow stay inside the tour — without it the shadow fell on the block below; the foot's
          padding is longer than the shadow's reach, so the next block never cuts it into an edge (both measured) */}
      {/* THE GROUND: one painted gradient for the whole journey, the grain that keeps it from banding,
          the hairline columns and the pool of light the window opens in */}
      <div aria-hidden="true" className="landing-dawn absolute inset-0 -z-10" data-dir={a === 'dark' ? 'night-day' : 'day-night'}>
        <div className="landing-grain absolute inset-x-0" />
        <div className="landing-grain absolute inset-x-0" data-band="back" />
        <div data-theme={a} className="landing-columns absolute inset-x-0 top-0 h-[1500px]" />
        <div data-theme={a} className="landing-pool absolute inset-x-0 top-0 h-[1700px]" />
      </div>

      <OnGround ground={a}>
        <div data-theme={a} className="text-textPrimary">
          {head}
        </div>
      </OnGround>

      <div ref={grid} id="tools" className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10 lg:grid lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-x-10 xl:gap-x-12 2xl:gap-x-20 scroll-mt-24">
        {/* THE WINDOW — first in the markup so that, in one column, it pins above the words */}
        <div
          ref={cell}
          className="sticky z-10 self-start lg:col-start-2 lg:row-start-1 h-[50svh] lg:h-[calc(100svh-128px)] lg:max-h-[980px]"
          style={{ top: small ? PIN_TOP_SMALL : PIN_TOP }}
          data-tour-window
        >
          <div ref={box} className={dockable ? 'landing-box absolute top-0 right-0 w-full h-full' : 'h-full'} data-tour-box>
            {/* docking: the box is given the picture's shape (measure). One column: a fixed band the picture fills. A desk that
                does not dock (less motion asked for): the window sizes itself by the picture. */}
            <TerminalWindow path={path} theme={turned ? b : a} desk={!small} natural={!dockable && !small} className={!dockable && !small ? '' : 'h-full'} />
          </div>
          {/* in one column the words pass under the window — they dissolve into it rather than being cut */}
          <div aria-hidden="true" className="lg:hidden pointer-events-none absolute inset-x-0 top-full h-10 backdrop-blur-md [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        </div>

        <div className="lg:col-start-1 lg:row-start-1 pt-10 lg:pt-0" style={{ paddingTop: dockable ? lead : undefined }}>
          {steps.map((s, i) => {
            const ground = turnAt >= 0 && i >= turnAt ? b : a;
            const on = active === s.id;
            const shown = picked[s.id] ?? s.path;
            return (
              <article
                  key={s.id}
                  ref={el => {
                    if (el) stepEls.current.set(s.id, el);
                    else stepEls.current.delete(s.id);
                  }}
                  data-tour-step={s.id}
                  data-theme={ground}
                  data-on={on || undefined}
                  className="text-textPrimary"
                >
                  {/* THE TURN'S QUIET STRETCH: the ground changes and the terminal follows. Two lines, each on
                      the end of the gradient it names, so neither is ever read over the steel in the middle. */}
                  {s.turn && (
                    <div ref={band} className="relative h-[96svh] lg:h-[135svh]" data-tour-band>
                      {s.turnSays && (
                        <>
                          <p data-theme={a} className="absolute inset-x-0 top-[6%] max-w-[11ch] text-textPrimary font-light text-[38px] lg:text-[52px] leading-[1.02] tracking-[-0.04em]">
                            {s.turnSays[a]}
                          </p>
                          <p data-theme={b} className="absolute inset-x-0 bottom-[6%] max-w-[11ch] text-textPrimary font-light text-[38px] lg:text-[52px] leading-[1.02] tracking-[-0.04em]">
                            {s.turnSays[b]}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  <OnGround ground={ground}>
                    {/* the first tool's words arrive as the window comes home; after that, the tool on screen is bright and the rest wait */}
                    <motion.div style={i === 0 ? { opacity: reveal } : undefined} className="min-h-[64svh] lg:min-h-[90svh] pb-16">
                    <div className={`transition-opacity duration-500 motion-reduce:transition-none ${on || (i === 0 && active === null) ? '' : 'opacity-[0.38]'}`}>
                      <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-textMuted">
                        <span className="w-8 h-px bg-textMuted/60" aria-hidden="true" />
                        {s.code && <span className="text-textPrimary tnum">{s.code}</span>}
                        {s.kind}
                      </p>
                      {/* THE ROOM'S HEAD WEARS ITS GLYPH (2026-10-01), as a product's page head does inside the terminal */}
                      <h3 className="mt-5 flex items-center gap-4 lg:gap-5 text-[44px] sm:text-[56px] lg:text-[50px] xl:text-[54px] 2xl:text-[64px] font-light leading-[0.98] tracking-[-0.04em] [text-wrap:balance]" data-tour-head={s.id}>
                        {/* A BIT SMALLER (2026-10-02 — the owner: "make the logos a bit smaller their a bit big right now"): 30, from 40 */}
                        {s.glyph && <ProductGlyph name={s.glyph} size={30} bare className="shrink-0 max-sm:w-[26px] max-sm:h-[26px]" />}
                        <span className="min-w-0">{s.name}</span>
                      </h3>
                      <p className="mt-6 max-w-[40ch] text-[17px] 2xl:text-[18px] leading-[1.5]">
                        <span className="font-medium text-textPrimary">{s.leadFor?.[ground] ?? s.lead}</span> <span className="text-textSecondary">{s.rest}</span>
                      </p>
                      <ul className="mt-9 border-t border-borderSubtle">
                        {s.rows.map(r => {
                          const here = !!r.path && r.path === shown;
                          const body = (
                            <>
                              <span className={`text-[15px] font-medium ${here ? 'text-textPrimary' : r.path ? 'text-textSecondary group-hover:text-textPrimary' : 'text-textPrimary'}`}>{r.title}</span>
                              <span className="mt-1 block text-[13.5px] leading-snug text-textMuted">{r.says}</span>
                            </>
                          );
                          return (
                            <li key={r.title} className="border-b border-borderSubtle">
                              {r.path ? (
                                <button
                                  type="button"
                                  onClick={() => setPicked(p => ({ ...p, [s.id]: r.path! }))}
                                  aria-pressed={here}
                                  data-tour-row={r.path}
                                  className="group relative w-full text-left py-3.5 pl-4 pr-8 transition-colors hover:bg-ink/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-silver"
                                >
                                  {/* silver is where you are */}
                                  <span aria-hidden="true" className={`absolute left-0 top-3 bottom-3 w-[2px] rounded-full transition-colors ${here ? 'bg-silver' : 'bg-transparent'}`} />
                                  {body}
                                  <ArrowRight aria-hidden="true" className={`absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition ${here ? 'text-silver' : 'text-textMuted opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                                </button>
                              ) : (
                                <div className="py-3.5 pl-4 pr-8">{body}</div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      <button
                        type="button"
                        onClick={() => onOpen(shown)}
                        /* the door's arrow glides under the pointer, like every door with an arrow on this page (Landing.tsx DOOR_ARROW) */
                        className="group/door mt-8 inline-flex items-center gap-2 h-10 pl-4 pr-3.5 rounded-full border border-borderMuted text-[13.5px] font-medium text-textPrimary hover:border-textPrimary/70 hover:bg-ink/[0.06] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver"
                        data-tour-door={s.id}
                      >
                        Open {s.turn ? 'the terminal' : s.name.replace(/^The /, 'the ')}
                        <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/door:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/door:translate-x-0" aria-hidden="true" />
                      </button>
                    </div>
                    </motion.div>
                  </OnGround>
                </article>
            );
          })}
          {/* THE TURN BACK: the ground goes home and the terminal with it. The tour's last words stand here, one line on each ground. */}
          <div ref={bandBack} className="relative h-[84svh] lg:h-[112svh]" data-tour-band="back">
            <p data-theme={b} className="absolute inset-x-0 top-[6%] max-w-[11ch] text-textPrimary font-light text-[38px] lg:text-[52px] leading-[1.02] tracking-[-0.04em]">
              {endSays[0]}
            </p>
            <p data-theme={a} className="absolute inset-x-0 bottom-[6%] max-w-[11ch] text-textPrimary font-light text-[38px] lg:text-[52px] leading-[1.02] tracking-[-0.04em]">
              {endSays[1]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tour;
