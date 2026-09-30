/*
==================================================
  SLAYER TERMINAL - PALETTE (components/ui/Palette.tsx)

  Bencho's "Palette" block (bencho.dev, MIT —
  bencho.dev/licence), brought in on Noah's word
  (2026-09-21, with two pictures of it: "i want the
  thermal to house switch to be this as well").
  Bencho's own comments are kept below as written:
  they say why the numbers are what they are, and
  they are most of what makes this worth copying
  rather than rewriting.

  WHAT IS OURS, ON TOP:
    · SETS — the block was a generator (a random
      OKLCH ramp and a button that finds another).
      Ours is a SWITCH between palettes it is given
      (`sets`, `index`, `onChange`): the swatches show
      the palette in use, the button orbs to the next.
      Without `sets` it is Bencho's generator, unchanged.
    · SIZE — Bencho's numbers are module constants; here
      they are props with those constants as defaults,
      so the Map's toolbar can have it at the height of
      its cards (a 20px bar in a 28px pill) and a page
      can have it at Bencho's 58. The blur rides the
      height (`HEAT` is per 58px of bar).
    · A LABEL inside the first pill — the house's cards
      are labelled ("COLOURS"), never bare.
    · `edge` puts the house's hairline on both pills
      (Bencho's Stroke control, `[data-stroke="on"]`).
  The tokens the CSS reads are mapped onto the house's
  on `.pal` itself (index.css), so nothing leaks out.
==================================================
*/

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useMotionValue, useSpring as useMotionSpring, useTransform, useVelocity } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

/* ══ Palette ══════════════════════════════════════════════
   Three to five colours that go together, and a button that
   finds you another set.

   ── THE COLOURS ARE PICKED IN OKLCH ───────────────────────
   Which is the entire difference between this and the random
   hex generator everybody writes first. In HSL, `lightness`
   is a lie: hsl(60 90% 50%) is a bright yellow and
   hsl(240 90% 50%) is a near-black blue, at the same number.
   So a palette built by holding L and stepping the hue comes
   out with one swatch that glows and one you can barely see.

   OKLCH is perceptually uniform — equal steps in L look like
   equal steps — so a ramp written in it is a ramp you can
   actually see. The palette is generated there and converted
   to hex on the way out, because hex is what somebody wants
   to paste into their own file.

   ── AND THEY ARE A RAMP, NOT A SPIN ───────────────────────
   Four random hues do not make a palette however even their
   lightness is. What makes a set look chosen is that it
   agrees about one thing and varies another: these hold a
   hue family and ramp the LIGHTNESS across it, which is what
   a designer does by hand.

   Chroma peaks in the middle rather than being held flat, for
   the same reason a very light and a very dark colour cannot
   be vivid — there is no room left in the gamut, and asking
   for it is what makes generated palettes go chalky at one
   end and muddy at the other. */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ── oklch → hex ───────────────────────────────────────────
   Björn Ottosson's matrices, unchanged. The path is
   oklch → oklab → LMS → linear sRGB → sRGB, and the only
   liberty taken is the clamp at the end: a colour outside the
   gamut is clipped per channel rather than gamut-mapped,
   which is the wrong answer in general and a fine one here
   because the chroma below never asks for one. */
function hex(L: number, C: number, H: number) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;

  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];

  return (
    '#' +
    lin
      .map(v => {
        const g = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.abs(v) ** (1 / 2.4) - 0.055;
        return Math.round(clamp(g, 0, 1) * 255)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}

export type Swatch = { hex: string };

/* ── one palette ───────────────────────────────────────────
   A base hue, a step between neighbours, and a ramp down the
   lightness. Everything else falls out of those three.

   The step is small and can go either way — 16 to 34 degrees
   — which keeps the family analogous rather than scattered. A
   wider spread is not a bolder palette, it is a list of
   colours.

   One set in three gets an ACCENT: the last swatch jumps most
   of the way round the wheel. A ramp on its own is tasteful
   and slightly dull, and the odd jump is what stops a run of
   generated sets feeling like one set regenerated.

   150 to 175 degrees rather than a flat 180. A true
   complement is the harshest pair on the wheel — it was
   putting a forest green on the end of a set of pinks, which
   is a colour theory exercise rather than a palette. Backing
   off a few degrees is the split-complement every painter
   uses instead, and it keeps the accent surprising without
   making it an argument.

   And it continues in the ramp's own direction rather than
   picking a side: an accent that jumped backwards past the
   colours it came from reads as a mistake in the sequence. */
function make(n: number): Swatch[] {
  const base = Math.random() * 360;
  const step = (16 + Math.random() * 18) * (Math.random() < 0.5 ? -1 : 1);
  const accent = Math.random() < 0.34;

  return Array.from({ length: n }, (_, i) => {
    const p = n === 1 ? 0 : i / (n - 1);
    /* light at the top of the ramp, deep at the bottom */
    const L = 0.9 - p * 0.5;
    /* and vivid in the middle, where the gamut has the room */
    const C = 0.05 + Math.sin(p * Math.PI) * 0.105;
    const H = accent && i === n - 1 ? base + (n - 1) * step + (150 + Math.random() * 25) * Math.sign(step) : base + i * step;
    return { hex: hex(L, C, ((H % 360) + 360) % 360) };
  });
}

/* ── the layout ────────────────────────────────────────────
   TWO PILLS SIDE BY SIDE: the colours in one, the refresh in
   its own. It was a single slab with the button tucked in at
   the right, which made the button part of the palette — and
   it is not, it is the thing that replaces the palette. A
   control that acts on an object should not be sitting inside
   it.

   Split, the two read as what they are: a display and a
   button. They share a height, a padding and a corner, so
   nothing about them says they are unrelated — only that they
   are two things.

   The swatches inside the first pill are still SEGMENTS of one
   bar rather than four cards in a row: a palette is one thing
   made of parts, and four separate tiles read as four separate
   decisions.

   The button pill's inside is one swatch square, and its
   button takes the swatch's corner — so the tool pill holds a
   swatch-shaped thing and the corner knob moves both. */
const W = 300;
/* the inset inside each pill. It was also the gap between
   them — see GAP, which is where that stopped being true. */
const PAD = 10;
const BAR_H = 58;
/* ── how wide the refresh is ───────────────────────────────
   The button is as TALL as a swatch and much narrower than
   one. It was a square, which made the tool pill the same
   shape as the thing it acts on and gave an 18px glyph a 58px
   box to sit in — a lot of empty pill for one icon.

   30 against a 58 height is nearly two to one, which is what
   makes it read as a KEY: an upright slot you press, rather
   than a tile that happens to have a glyph on it. There is no
   hover fill for it to need room for any more — the glyph
   just lightens — so the six pixels either side of the icon
   are the whole of what the button has to hold.

   Every pixel it gives up goes to the colours: the swatches
   are 53 wide now, against 45 when this was a square. */
const TOOL = 30;
/* ── the air between the two pills ─────────────────────────
   6, and it is no longer PAD. Those two were deliberately the
   same number once, back when the button sat INSIDE the slab:
   the gap beside the bar and the gap above it were the same
   kind of space, and two numbers there would have been a
   decision nobody made.

   They are two objects now, and the space BETWEEN two objects
   is not the space inside one. At 10 the pills read as two
   things that happen to be near each other; at 6 they read as
   a pair — near enough to belong together, far enough apart
   to be separate, which is exactly what they are. */
const GAP = 6;
const CORNER = 14;
const BASE = 760;
/* ── the gap between swatches ──────────────────────────────
   Small on purpose. The bar was one flush strip and the
   colours were segments of it, which meant the rounded ends
   had to come from the container clipping them — and a swatch
   that cannot leave its slot cannot overshoot, so the elastic
   on the way back was being cut off at the edges.

   Four is enough to read as four objects and not enough to
   stop reading as one bar. It is also what lets the goo do
   something at rest-adjacent moments: a blur of five bridges
   four pixels, so the swatches neck toward each other as they
   move and part again cleanly. */
const SEAM = 4;

/* ── the one way a colour becomes another one ──────────────
   ORB: the swatch draws into a circle, changes colour there,
   and spreads back out into its slot.

   There were five, then three, and now one. The other four
   were not broken — `pinch` necked into a droplet, `flip`
   turned edge-on, `split` parted in two, `bounce` squashed
   flat — but a block that ships four ways to do one thing is
   asking whoever opens it to rule out three by hand, and none
   of them said anything this does not.

   What every survivor had in common, and every discarded one
   lacked, is worth keeping written down: the swatch DEFORMS
   and swaps its colour at the frame there is least of it to
   look at. Nothing here fades one colour into another. An
   alpha-contrast filter blurs SourceGraphic, so anything
   painting a new colour over an old one inside the same
   swatch shows you the two smeared together — every muddy
   value in between, and none of them in either palette. Each
   swatch is one solid colour at every frame, and the blur only
   ever bridges the gap BETWEEN swatches. That is liquid; the
   other thing is smear. */

/* how much blur the run carries. Zero at rest — see the note
   where it is used. */
const HEAT = 5;

/* ── they all go at once ───────────────────────────────────
   Every swatch runs the same clock. They used to be staggered,
   each on its own window of the run, so the change travelled
   along the bar — which is a nice effect and the wrong one
   here. A wave says the swatches are a sequence and that one
   caused the next; they are not, they are a set, and pressing
   refresh replaces all of them in the same instant. Together
   is what that press actually did.

   It also makes the goo mean more rather than less: four
   swatches contracting on the same frame leave four gaps
   opening at the same rate, and the bridge between them is one
   piece of motion instead of a blur chasing a wavefront. */

/* ── out fast, back PAST the mark ──────────────────────────
   The deformation is not a sine. A sine is symmetric and
   lands exactly on rest, which is a shape being resized; what
   makes these read as elastic is that the return overshoots —
   the swatch comes back a few per cent bigger than it needs to
   be and settles. That is the whole difference between
   `animated` and `springy`, and it costs one back-out curve.

   The change happens at OUT, the top of the deformation, and
   the longer tail after it is the settle. */
const OUT = 0.4;
const back = (k: number) => {
  const c = 1.7;
  const u = k - 1;
  return 1 + (c + 1) * u ** 3 + c * u ** 2;
};
const swellOf = (ti: number) => (ti <= 0 ? 0 : ti < OUT ? 1 - (1 - ti / OUT) ** 3 : 1 - back((ti - OUT) / (1 - OUT)));

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/* ── inlined from ./motionkit ──────────────────────── */
/* ══ liquid ═══════════════════════════════════════════════
   Shared parts for the Framer Motion layer: one spring, one
   goo filter, one velocity→skew binding.

   ── why the filter is a hook ────────────────────────────
   The filter is embedded in each component's own return, but
   its id CANNOT be a literal. Every block here renders twice
   at once — once in the wall card, once in the detail overlay
   — and duplicate SVG ids do not scope, they collide: the
   second instance silently steals the first one's filter.
   useId() gives each mount its own name.

   ── what the goo can and cannot do ──────────────────────
   This is feGaussianBlur + feColorMatrix, not a shader. The
   matrix multiplies alpha by `cut` and subtracts half of it,
   so alpha below 0.5 lands on zero and everything above 0.536
   is fully opaque. That hard edge is what fuses nearby shapes
   into one blob — and it is also why this must never touch
   text: glyph antialiasing lives entirely below 0.5, so type
   under this filter loses its edges and then itself. */

/* the elastic, as specified: ζ = 14 / (2·√(220·0.5)) ≈ 0.67,
   so it overshoots about 6% before it settles. A deliberate
   bounce, not a wobble. */
export const LIQUID = {
  type: 'spring' as const,
  stiffness: 220,
  damping: 14,
  mass: 0.5,
};

/* Non-drag blocks reuse the same feel without the overshoot,
   so a toggle does not bounce like a dragged card. */
/* ── the same liquid, without the overshoot ────────────────
   For shapes whose corner radius is animating: a spring that
   passes its target drags the radius past it too, and corners
   that dip under and come back read as a wobble rather than
   as a bounce.

   NOT just LIQUID with more damping, which is what this was.
   Raising damping alone to 30 against the same stiffness put
   ζ at 1.43 — comfortably overdamped, so it stopped
   overshooting by creeping: about 470ms to settle, against
   LIQUID's 290ms. It read as slow because it was.

   Stiffness comes up with the damping instead, which holds ζ
   at 1.03 — no overshoot, and it lands in about 180ms. */
export const LIQUID_STILL = { ...LIQUID, stiffness: 420, damping: 30 };

export function useGoo(blur = 7, cut = 28) {
  /* useId yields ":r0:" — legal in an id attribute but not in
     a url(#…) reference, so strip the colons. */
  const id = `goo-${useId().replace(/:/g, '')}`;
  const goo = (
    <svg className="liq-defs" aria-hidden="true" focusable="false">
      <defs>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="smear" />
          <feColorMatrix in="smear" type="matrix" values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${cut} ${-(cut / 2)}`} />
        </filter>
      </defs>
    </svg>
  );
  return { id, url: `url(#${id})`, goo };
}

/* ── drag velocity → skew ────────────────────────────────
   Feed x/y as the thing moves; the element leans against its
   own motion. Springing the skew rather than reading velocity
   raw is what keeps it organic — raw velocity is noisy enough
   to read as a jitter. */
export function useDragSkew(limit = 12, range = 1600) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const vx = useVelocity(x);
  const vy = useVelocity(y);
  const skewX = useMotionSpring(useTransform(vx, [-range, range], [limit, -limit]), LIQUID);
  const skewY = useMotionSpring(useTransform(vy, [-range, range], [limit / 2, -limit / 2]), LIQUID);
  return { x, y, skewX, skewY };
}

/* ── token → real colour ─────────────────────────────────
   Framer interpolates colours, but only real ones. A custom
   property does not qualify twice over: getPropertyValue
   hands back the unresolved token stream, and half of these
   tokens are color-mix(), which is not a colour until
   something computes it.

   So we let the engine do it. A hidden probe inside the
   component inherits the component's own custom properties —
   including any [data-fill] or [data-surface] override on an
   ancestor — and `color` on it computes all the way down to
   an rgb triple we can hand to Framer.

   Re-read whenever the theme or fill flips, or the animation
   would tween toward the previous palette. */
export function useTokens(ref: React.RefObject<HTMLElement | null>, names: string[]): Record<string, string> {
  const [vals, setVals] = useState<Record<string, string>>({});
  const key = names.join('|');
  const last = useRef('');

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const read = () => {
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
      host.appendChild(probe);
      const next: Record<string, string> = {};
      for (const n of names) {
        /* a bare token gets wrapped; anything else (a fallback
           chain, a literal) is already a colour expression */
        probe.style.color = n.startsWith('--') ? `var(${n})` : n;
        next[n] = getComputedStyle(probe).color;
      }
      probe.remove();
      const sig = JSON.stringify(next);
      if (sig !== last.current) {
        last.current = sig;
        setVals(next);
      }
    };

    read();

    /* every ancestor that can redefine the palette */
    const mo = new MutationObserver(read);
    const flags = ['data-theme', 'data-fill', 'data-surface', 'data-stroke'];
    for (let el: HTMLElement | null = host; el; el = el.parentElement) {
      mo.observe(el, { attributes: true, attributeFilter: flags });
    }
    return () => mo.disconnect();
  }, [ref, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return vals;
}

/* ── inlined from ./motion ──────────────────────── */
/* ── elastic, as numbers a person can hold ─────────────────
   Several blocks here are the same idea in different clothes:
   something travels, stretches on the way, and overshoots
   when it lands. Their character lives in a duration and in
   one control point of a bezier — which is exactly the kind
   of thing nobody should have to name in order to tune.

   So the outside of every elastic knob is 0..100 and the
   inside is real units, and **50 is always what the component
   was already tuned to**. Turn every knob on the bench to the
   middle and nothing has changed. That is what makes these
   safe to expose: the default is not a number somebody has to
   remember, it is the middle of the slider.

   Both ends have to be shippable, which is the constraint
   that actually shapes these curves. The ranges below stop
   where the effect stops being the thing it is — a bar that
   moves in 40ms still reads as a bar snapping to a slot; one
   that moves in 20ms reads as broken. */

/* How long it takes, slower to faster, as a multiplier on
   whatever the component's own tuned duration is. 0 is a
   little over half again as slow, 100 is two and a half times
   as fast, 50 is exactly 1. */
export const rate = (speed: number) => 1.6 - (speed / 100) * 1.2;

/* How hard it lands.

   In a cubic-bezier the second control point's y is the whole
   of an overshoot: at 1 the thing stops dead on its target,
   and past 1 it travels beyond and comes back. Everything
   else in the curve is the approach and stays put.

   `tuned` is the y this component was drawn with, so 50
   returns it unchanged and the slider is centred on the
   design rather than on some shared average. */
export const overshoot = (bounce: number, tuned: number) => Number((1 + (bounce / 100) * (tuned - 1) * 2).toFixed(3));

/* the same, ready to drop into a transition */
export const curve = (bounce: number, tuned: number, x1 = 0.28, x2 = 0.36) => `cubic-bezier(${x1}, ${overshoot(bounce, tuned)}, ${x2}, 1)`;

/* ── inlined from ./spring ──────────────────────── */
/* ── one spring, for everything that settles ───────────────
   The maths was already on this bench twice, copied by hand:
   Humidity's wheel and Brightness's column both accumulate
   velocity toward a target, damp it, and snap when both the
   delta and the velocity fall under 0.02. Two copies is a
   coincidence; five would be a policy, so it comes out here
   before the elastic blocks are written against it.

   The two shipped copies are deliberately NOT refactored onto
   this. They work, they are tuned, and rewriting the innards
   of two live components to prove a point about duplication
   is how a good afternoon becomes a bad one. This is the one
   new code uses.

   Frames, not milliseconds. `dt` is expressed in sixtieths of
   a second and the damping is RAISED to it rather than
   multiplied by it, so a dropped frame decays the same amount
   of energy as the two frames it replaced. Multiplying is the
   version that makes a spring behave differently on a busy
   page, which is the hardest kind of bug to see.

   The loop parks itself the moment the value has settled.
   CLAUDE.md is not complimentary about the one permanent
   requestAnimationFrame already on this bench and there is no
   case for five more. */

/* 0..100 into the two numbers a spring actually has.

   50 is what Humidity and Brightness were tuned at, which is
   the rule every elastic knob on this bench follows — see
   lab/motion. Turn the panel to the middle and nothing has
   changed.

   Both ends have to be usable, which is what fixes the range:
   at 0 it is slow and heavy and still arrives, at 100 it is
   quick with a visible overshoot, and nowhere in between does
   it ring for longer than it takes to read. */
/* The pair is chosen by DAMPING RATIO and then written back
   as stiffness and decay, because the ratio is the thing a
   person is actually setting and the two numbers on their own
   do not say what they add up to.

     zeta = -ln(d) / (2 * sqrt(k))

   The first version of this ran 0.06..0.26 stiffness against
   0.93..0.74 decay, which reads as a sensible spread and is
   not one: it puts zeta between 0.15 and 0.16 across the
   WHOLE range, so every setting overshot by about sixty per
   cent and the knob only changed how fast it did it. Pull's
   return went 130px past its own resting position and lifted
   the content off the top of the card.

     0   → zeta ~0.85, heavy, arrives without a ring
     50  → zeta ~0.41, near where Humidity and Brightness sit
     100 → zeta ~0.20, lively, two visible rebounds

   Both ends shippable, which is the constraint that fixed the
   numbers rather than taste. */
const springOf = (tune: number) => ({
  /* stiffness: how hard it is pulled toward the target */
  k: 0.08 + (tune / 100) * 0.16,
  /* decay, per frame: how much of the velocity survives */
  d: 0.62 + (tune / 100) * 0.2,
});

/* Units matter. The snap threshold is absolute, so a caller
   works in pixels or in 0..100 — a spring driven over 0..1
   would be "settled" before it had visibly moved. */
export function useSpring(target: number, tune = 50, instant = false) {
  const [at, setAt] = useState(target);
  const cur = useRef(target);
  const vel = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (instant) {
      cur.current = target;
      vel.current = 0;
      setAt(target);
      return;
    }
    const { k, d } = springOf(tune);
    let prev = 0;
    const tick = (t: number) => {
      const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
      prev = t;
      vel.current += (target - cur.current) * k * dt;
      vel.current *= Math.pow(d, dt);
      cur.current += vel.current * dt;
      if (Math.abs(target - cur.current) < 0.02 && Math.abs(vel.current) < 0.02) {
        cur.current = target;
        vel.current = 0;
        setAt(target);
        raf.current = 0;
        return;
      }
      setAt(cur.current);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
    /* `tune` sits here beside `target` for the reason
       Brightness spells out: the loop closes over it, so
       without it a knob turned mid-flight would do nothing
       until something else restarted the effect. Restarting
       picks up from the refs, so it continues rather than
       snapping. */
  }, [target, tune, instant]);

  return at;
}

/* Read once, the way the wheel and the pill nav do. A
   preference, not a live input. */
const stillness = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export interface PaletteProps {
  /* how many colours, 3..5 — the generator's; with `sets` the
     set's own count stands */
  count?: number;
  /* the swatch's corner, 0..29 — half of a 58px swatch, which
     is the pill, so the slider runs from square to as round as
     the shape can be. The ceiling moves with BAR_H; past half
     the height a rounded rectangle stops changing. */
  corner?: number;
  /* how quickly a colour changes, 0..100 */
  morph?: number;
  /* ── SETS: a switch, not a generator (ours) ──────────────
     The palettes to stand between, as CSS colours — the
     swatches show `sets[index]`, the button orbs to the next
     and says so through `onChange`. The host owns which is on;
     the block only ever asks. */
  sets?: string[][];
  index?: number;
  onChange?: (index: number) => void;
  /* the house's cards are labelled: "COLOURS" before the bar */
  label?: ReactNode;
  /* what the button says it does — "Colours: House. Press for Thermal" */
  title?: string;
  /* the house's hairline on both pills (Bencho's Stroke control) */
  edge?: boolean;
  /* ── SIZE (ours): Bencho's constants, as props ────────────
     `width` is the whole thing (W); with `swatch` the bar is
     built from the swatch's width instead and the whole takes
     what that comes to — a label inside the pill would have
     eaten the bar's share of a fixed width. */
  width?: number;
  swatch?: number;
  barH?: number;
  pad?: number;
  tool?: number;
  gap?: number;
  seam?: number;
  testId?: string;
}

export function Palette({ count = 4, corner = CORNER, morph = 50, sets, index = 0, onChange, label, title, edge = false, width = W, swatch, barH = BAR_H, pad = PAD, tool = TOOL, gap = GAP, seam = SEAM, testId }: PaletteProps = {}) {
  const given = sets && sets.length > 0 ? sets : null;
  const at = given ? ((index % given.length) + given.length) % given.length : 0;
  const n = given ? given[at].length : clamp(Math.round(count), 3, 5);
  const [own, setOwn] = useState<Swatch[]>(() => (given ? [] : make(n)));
  /* with sets the palette is the host's; the block never keeps a copy that could drift from it */
  const pal: Swatch[] = given ? given[at].map(hex => ({ hex })) : own;
  const [next, setNext] = useState<Swatch[] | null>(null);
  const [t, setT] = useState(0);
  const raf = useRef(0);
  const spins = useRef(0);
  const still = stillness();

  /* the palette follows the knob without waiting for a press */
  if (!given && own.length !== n) {
    setOwn(make(n));
    setNext(null);
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const roll = () => {
    /* a press mid-run is ignored rather than queued: a second
       set arriving over a half-finished one would leave some
       swatches showing a palette that no longer exists */
    if (raf.current) return;
    spins.current += 1;

    const to = given ? (at + 1) % given.length : -1;
    const fresh: Swatch[] = given ? given[to].map(hex => ({ hex })) : make(n);
    if (still) {
      if (given) onChange?.(to);
      else setOwn(fresh);
      return;
    }

    setNext(fresh);
    const ms = BASE * rate(clamp(morph, 0, 100));
    const t0 = performance.now();
    /* THE HOST HEARS AT THE SWAP, not at the landing (Noah, 2026-09-21: "the actual color change is quite laggy"):
       the swatches take the new colours at OUT, the top of the deformation, and that is the frame the host should
       change on too — the first cut told it when the run landed, so the ladder began to glide 760ms after the press
       and finished 700ms after that (measured: the first bar changed at 826ms). Told at OUT, the host's own glide runs
       under the orbs' return and lands with them. The prop it answers with is the set the run is already showing
       past OUT, so nothing on screen changes twice. */
    let told = false;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setT(p);
      if (!told && p >= OUT) {
        told = true;
        if (given) onChange?.(to);
      }
      if (p < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        raf.current = 0;
        /* the generator learns its new set as the run lands — the same render clears the run, so the swatches never
           show the old palette between the two */
        if (!given) setOwn(fresh);
        setNext(null);
        setT(0);
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  /* the tool pill takes the same padding as the other one, so
     the two come out the same height without either being told
     what the other is */
  const toolW = tool + pad * 2;
  /* the seams come out of the row before it is divided, so
     the swatches stay equal whatever the count is */
  const barW = swatch != null ? swatch * n + seam * (n - 1) : width - toolW - gap - pad * 2;
  const seg = (barW - seam * (n - 1)) / n;
  const step = seg + seam;
  /* ── the goo rides the run ───────────────────────────────
     Zero at rest, so the seams are as crisp as two rectangles
     — a standing blur would smear neighbouring colours into
     each other and turn the bar into one gradient. It only
     reaches while something is moving, and because every
     swatch is a single solid colour at every frame, the blur
     it applies can only ever bridge the gap BETWEEN two
     swatches. That is the liquid; there is no smear anywhere
     inside a colour. */
  /* the blur is sized by THE NECK — the gap two swatches have to bridge on the way back, the seam plus what the orbs
     are still giving up at that moment (read at three tenths of the swell, where Bencho's fuse): his 5px of blur
     bridges a 10px neck (a 4px seam, 58px swatches drawn in to 38). Scaled by the bar's height instead (a third, on
     the 20px toolbar bar) the swatches never necked and the run read as four discs shrinking (Noah, 2026-09-21: "the
     animation doesn't seem like a 1 to 1 with what i brought you"); scaled by the seam alone it bridged too far and
     smeared three colours into one band — the blur must stay small against the swatch (his is a tenth of it). */
  const NECK_REF = SEAM + 0.3 * (53 - BAR_H * 0.66);
  const heat = Math.sin(Math.PI * clamp(t, 0, 1)) * HEAT * ((seam + 0.3 * (seg - barH * 0.66)) / NECK_REF);
  const { url: gooUrl, goo } = useGoo(heat, 26);

  const r = clamp(corner, 0, barH / 2);
  /* ── the slab's corner, and why it is not just r + PAD ────
     Concentric is the right rule for a curve wrapping another
     curve: stay one padding out and the two stay parallel.
     But at r = 0 there is no curve to stay parallel TO, and a
     flat rule leaves square swatches sitting in a rounded
     slab — two different decisions in one object, which is
     the thing this knob exists to keep in agreement.

     So the offset FADES IN over the first CORNER pixels. The
     default and the top of the slider are untouched — 14
     still gives 24, 29 still gives 39 — only the bottom end,
     which is the end that was wrong. */
  const slabR = r + pad * Math.min(1, r / CORNER);

  /* ── the beat ────────────────────────────────────────────
     The whole colour pill dips while the swatches are drawn
     in, and comes back a hair past its own size — the swatches
     contracting is a small motion happening inside a box that
     is not moving, and the box giving with them is what makes
     the press land on the palette rather than on four shapes
     in it.

     This is the one place here that uses a SCALE rather than
     writing width and height, which is normally how a corner
     radius gets dragged out of shape. At three and a half per
     cent it is under a pixel of radius, and more to the point
     nobody reads a pulse as a change of shape — they read it
     as a pulse. Writing the size instead would relayout the
     bar under the swatches every frame, which is the thing
     actually worth avoiding.

     Raw `swellOf`, not the clamped `d` the swatches use: the
     tail of that curve goes past rest, so the pill returns
     slightly over 1 and settles. That overshoot IS the beat —
     clamp it away and this is just a shrink. */
  const beat = 1 - 0.035 * swellOf(clamp(t, 0, 1));

  return (
    <div className="pal" style={{ ...(swatch == null ? { width } : {}), gap }} data-stroke={edge ? 'on' : undefined} data-palette-switch={testId} data-palette-index={given ? at : undefined} data-palette-running={raf.current ? '' : undefined}>
      <div className="pal-slab" style={{ padding: pad, borderRadius: slabR, scale: beat }}>
        {label != null && (
          <span className="pal-label" aria-hidden="true">
            {label}
          </span>
        )}
        {/* No clip and no corner of its own. Each swatch
            carries its own radius, so the bar is only a box to
            position them in — and a bar that clipped would cut
            off the overshoot, which is the part of the motion
            worth keeping. */}
        <div className="pal-bar" style={{ height: barH, width: barW }}>
          <div className="pal-blobs" aria-hidden="true" style={{ filter: gooUrl }}>
            {pal.map((c, i) => {
              /* one clock, read by every swatch — see the note
                 above on why they are not staggered */
              const ti = clamp(t, 0, 1);
              /* the change happens at the top of the
                 deformation, which is the frame there is least
                 of the swatch to see */
              const shown = next && ti >= OUT ? next[i].hex : c.hex;
              const d = Math.max(0, swellOf(ti));

              /* into a circle and back out into its slot */
              const side = mix(seg, barH * 0.66, d);
              const h = mix(barH, barH * 0.66, d);
              return (
                <span
                  key={i}
                  className="pal-seg"
                  style={{
                    background: shown,
                    width: side,
                    height: h,
                    top: (barH - h) / 2,
                    borderRadius: mix(r, h / 2, d),
                    transform: `translateX(${(i * step + (seg - side) / 2).toFixed(2)}px)`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── the button, in a pill of its own ────────────────
          Same padding and same corner as the palette's, and
          the button inside it is one swatch square wearing the
          swatch's radius — so the corner knob moves this too
          and the two pills never disagree about what a corner
          is here. */}
      <div className="pal-slab pal-tool" style={{ padding: pad, borderRadius: slabR }}>
        <button className="pal-go" type="button" onClick={roll} aria-label={title ?? 'Generate a new palette'} title={title} style={{ width: tool, height: barH, borderRadius: r }} data-palette-go>
          {/* a turn per press, and it keeps turning the same
              way — a glyph that unwound would say "undo" */}
          <RefreshCw size={Math.round(Math.min(18, barH * 0.62))} strokeWidth={2.2} style={{ rotate: `${spins.current * 180}deg` }} />
        </button>
      </div>

      {goo}
    </div>
  );
}

export default Palette;
